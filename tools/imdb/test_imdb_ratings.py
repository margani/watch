import os
import tempfile
import unittest

from imdb_ratings import changed, parse, read_state, upsert_sql, write_state


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


if __name__ == "__main__":
    unittest.main()
