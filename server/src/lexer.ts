import { Location } from 'vscode-languageserver';

export type TokenKind =
	// Punctuation
	| ";" | "(" | ")" | "{" | "}" | "[" | "]"
	| "<" | ">" | "=" | ","
	// Operators
	| "+" | "-" | "*" | "/"
	// Keywords
	| "return" | "var" | "def"
	// Literals and identifiers
	| "IDENTIFIER" | "NUMBER"
	// Special
	| "COMMENT" | "EOF";

export interface Token {
	kind: TokenKind;
	text: string;
	location: Location;
};

const KEYWORDS: Record<string, TokenKind> = {
	'return': 'return',
	'var': 'var',
	'def': 'def',
};

const SINGLE_CHAR_TOKENS: Record<string, TokenKind> = {
	';': ';',
	'(': '(',
	')': ')',
	'{': '{',
	'}': '}',
	'[': '[',
	']': ']',
	'<': '<',
	'>': '>',
	'=': '=',
	',': ',',
	'+': '+',
	'-': '-',
	'*': '*',
	'/': '/',
};

export function tokenize(uri: string, src: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;

	function isEOF(): boolean {
		return pos >= src.length;
	}

	function peek(offset = 0): string | null {
		if (pos + offset >= src.length) {
			return null;
		}
		return src[pos + offset];
	}

	function advance(): string {
		return src[pos++];
	}

	function skipWhitespace(): void {
		while (!isEOF()) {
			const ch = peek();
			if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
				advance();
			} else {
				break;
			}
		}
	}

	function lexComment(start: number): Token {
		// Skip the '#' character (already consumed)
		while (!isEOF() && peek() !== '\n') {
			advance();
		}

		return {
			kind: 'COMMENT',
			text: src.substring(start, pos),
			location: makeLocation(start, pos)
		};
	}

	function makeLocation(start: number, end: number): Location {
		// Simple position calculation (line/column)
		let line = 0;
		let col = 0;
		for (let i = 0; i < start; i++) {
			if (src[i] === '\n') {
				line++;
				col = 0;
			} else {
				col++;
			}
		}

		let endLine = line;
		let endCol = col;
		for (let i = start; i < end; i++) {
			if (src[i] === '\n') {
				endLine++;
				endCol = 0;
			} else {
				endCol++;
			}
		}

		return {
			uri,
			range: {
				start: { line, character: col },
				end: { line: endLine, character: endCol }
			}
		};
	}

	function lexIdentifier(start: number): Token {
		while (!isEOF()) {
			const ch = peek();
			if (ch && /[a-zA-Z0-9_$.]/.test(ch)) {
				advance();
			} else {
				break;
			}
		}

		const text = src.substring(start, pos);
		const kind: TokenKind = KEYWORDS[text] || 'IDENTIFIER';
		return {
			kind,
			text,
			location: makeLocation(start, pos)
		};
	}

	function lexNumber(start: number): Token {
		const firstChar = src[start];

		// Check for hexadecimal
		if (firstChar === '0' && peek() === 'x') {
			advance(); // skip 'x'
			while (!isEOF() && /[0-9a-fA-F]/.test(peek()!)) {
				advance();
			}
			return {
				kind: 'NUMBER',
				text: src.substring(start, pos),
				location: makeLocation(start, pos)
			};
		}

		// Decimal number
		while (!isEOF() && /[0-9]/.test(peek()!)) {
			advance();
		}

		// Check for fractional part
		if (peek() === '.' && peek(1) && /[0-9]/.test(peek(1)!)) {
			advance(); // skip '.'
			while (!isEOF() && /[0-9]/.test(peek()!)) {
				advance();
			}

			// Check for exponent
			if (peek() === 'e' || peek() === 'E') {
				advance();
				if (peek() === '+' || peek() === '-') {
					advance();
				}
				while (!isEOF() && /[0-9]/.test(peek()!)) {
					advance();
				}
			}
		}

		return {
			kind: 'NUMBER',
			text: src.substring(start, pos),
			location: makeLocation(start, pos)
		};
	}

	// Main tokenization loop
	while (true) {
		skipWhitespace();

		if (isEOF()) {
			const eofPos = pos;
			tokens.push({
				kind: 'EOF',
				text: '',
				location: makeLocation(eofPos, eofPos)
			});
			break;
		}

		const start = pos;
		const ch = advance();

		// Comment
		if (ch === '#') {
			const token = lexComment(start);
			tokens.push(token);
			continue;
		}

		// Identifier or keyword
		if (/[a-zA-Z_]/.test(ch)) {
			const token = lexIdentifier(start);
			tokens.push(token);
			continue;
		}

		// Number
		if (/[0-9]/.test(ch)) {
			const token = lexNumber(start);
			tokens.push(token);
			continue;
		}

		// Single character tokens
		const singleCharKind = SINGLE_CHAR_TOKENS[ch];
		if (singleCharKind) {
			tokens.push({
				kind: singleCharKind,
				text: ch,
				location: makeLocation(start, pos)
			});
			continue;
		}

		// Unknown character - for now, skip it
		// In a real implementation, this should throw an error
	}

	return tokens;
}
