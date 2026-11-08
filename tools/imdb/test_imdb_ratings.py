import gzip
import io
import os
import tempfile
import unittest

from imdb_ratings import (
    changed,
    episodes_sql,
    gz_lines,
    parse,
    parse_episodes,
    read_episodes,
    read_state,
    upsert_sql,
    write_episodes,
    write_state,
)


class Ratings(unittest.TestCase):
    # Shaped like IMDb's title.ratings.tsv.
    LINES = [
        "tconst\taverageRating\tnumVotes\n",
        "tt0000001\t5.7\t2237\n",
        "tt0000002\t5.4\t99\n",
        "tt0111161\t9.3\t3100000\n",
        "nm0000001\t8.0\t5000\n",
        "tt0000003\tx\t500\n",
    ]

    def test_keeps_titles_with_enough_votes(self):
        self.assertEqual(
            parse(self.LINES, 100),
            {"tt0000001": (5.7, 2237), "tt0111161": (9.3, 3100000)},
        )

    def test_writes_only_what_changed(self):
        old = {"tt0000001": (5.7, 2237), "tt0111161": (9.3, 3099990)}
        new = {"tt0000001": (5.7, 2237), "tt0111161": (9.3, 3100000), "tt9999999": (7.0, 150)}
        self.assertEqual(changed(new, old), [("tt0111161", 9.3, 3100000), ("tt9999999", 7.0, 150)])
        self.assertEqual(changed(new, new), [])

    def test_upsert_statement(self):
        self.assertEqual(
            upsert_sql([("tt0111161", 9.3, 3100000), ("tt0000001", 5.7, 2237)]),
            "INSERT INTO imdb_ratings (imdb_id, rating, votes) VALUES ('tt0111161',9.3,3100000),"
            "('tt0000001',5.7,2237) ON CONFLICT(imdb_id) DO UPDATE SET rating = excluded.rating, "
            "votes = excluded.votes",
        )

    def test_state_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "sub", "last.tsv")
            self.assertEqual(read_state(path), {})
            write_state(path, {"tt0000001": (5.7, 2237)})
            self.assertEqual(read_state(path), {"tt0000001": (5.7, 2237)})



class Episodes(unittest.TestCase):
    # Shaped like IMDb's title.episode.tsv.
    LINES = [
        "tconst\tparentTconst\tseasonNumber\tepisodeNumber\n",
        "tt0000011\ttt0000100\t1\t1\n",
        "tt0000012\ttt0000100\t1\t2\n",
        "tt0000013\ttt0000100\t\\N\t\\N\n",
        "tt0000014\tnm0000100\t1\t3\n",
        "tt0000015\ttt0000100\tx\t3\n",
        "tt0000016\ttt0000200\t2\t0\n",
    ]
    RATED = {"tt0000011", "tt0000013", "tt0000014", "tt0000015", "tt0000016"}

    def test_keeps_rated_episodes_with_a_place_in_a_series(self):
        self.assertEqual(
            parse_episodes(self.LINES, self.RATED),
            {"tt0000011": ("tt0000100", 1, 1), "tt0000016": ("tt0000200", 2, 0)},
        )

    def test_a_changed_place_is_written_again(self):
        old = {"tt0000011": ("tt0000100", 1, 1), "tt0000016": ("tt0000200", 2, 0)}
        new = {"tt0000011": ("tt0000100", 1, 2), "tt0000016": ("tt0000200", 2, 0)}
        self.assertEqual(changed(new, old), [("tt0000011", "tt0000100", 1, 2)])

    def test_upsert_statement(self):
        self.assertEqual(
            episodes_sql([("tt0000011", "tt0000100", 1, 2)]),
            "INSERT INTO imdb_episodes (imdb_id, series_id, season, episode) VALUES "
            "('tt0000011','tt0000100',1,2) ON CONFLICT(imdb_id) DO UPDATE SET "
            "series_id = excluded.series_id, season = excluded.season, episode = excluded.episode",
        )

    def test_state_round_trip(self):
        rows = {"tt0000011": ("tt0000100", 1, 1), "tt0000016": ("tt0000200", 2, 0)}
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "sub", "episodes.tsv")
            self.assertEqual(read_episodes(path), {})
            write_episodes(path, rows)
            self.assertEqual(read_episodes(path), rows)

    def test_reads_a_gzip_stream_line_by_line(self):
        # title.episode is 10 million lines: it is read as a stream, not decoded whole in memory.
        class NoSeek(io.BytesIO):
            def seekable(self):
                return False

        data = gzip.compress("".join(self.LINES).encode())
        self.assertEqual(list(gz_lines(NoSeek(data))), self.LINES)


if __name__ == "__main__":
    unittest.main()
