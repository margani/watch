export function GET() {
	return Response.json(
		{ version: __APP_VERSION__, commit: __APP_COMMIT__ },
		{ headers: { 'cache-control': 'no-store' } }
	);
}
