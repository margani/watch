/** Only same-site paths: `?next=//evil.example` must not turn sign-in into an open redirect. */
export function safeNext(value: string | null | undefined): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
		return '/';
	return value;
}
