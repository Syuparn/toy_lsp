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
	| "COMMENT" | "EOF" | "UNKNOWN";

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

export class Tokenizer {
	pos: number;
	line: number;
	character: number;
	tokenStartLine: number;
	tokenStartCharacter: number;

	constructor(
		public uri: string,
		public src: string,
	){
		this.pos = 0;
		this.line = 0;
		this.character = 0;
		this.tokenStartLine = 0;
		this.tokenStartCharacter = 0;
	}

	private markTokenStart(): void {
		this.tokenStartLine = this.line;
		this.tokenStartCharacter = this.character;
	}

	private isEOF(): boolean {
		return this.pos >= this.src.length;
	}

	private peek(offset = 0): string | null {
		if (this.pos + offset >= this.src.length) {
			return null;
		}
		return this.src[this.pos + offset];
	}

	private advance(): string {
		const ch = this.src[this.pos++];
		if (ch === '\n') {
			this.line++;
			this.character = 0;
		} else {
			this.character++;
		}
		return ch;
	}

	private skipWhitespace(): void {
		while (!this.isEOF()) {
			const ch = this.peek();
			if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
				this.advance();
			} else {
				break;
			}
		}
	}

	private lexComment(start: number): Token {
		// Skip the '#' character (already consumed)
		while (!this.isEOF() && this.peek() !== '\n') {
			this.advance();
		}

		return {
			kind: 'COMMENT',
			text: this.src.substring(start, this.pos),
			location: this.makeLocation()
		};
	}

	private makeLocation(): Location {
		return {
			uri: this.uri,
			range: {
				start: { line: this.tokenStartLine, character: this.tokenStartCharacter },
				end: { line: this.line, character: this.character }
			}
		};
	}

	private lexIdentifier(start: number): Token {
		while (!this.isEOF()) {
			const ch = this.peek();
			if (ch && /[a-zA-Z0-9_$.]/.test(ch)) {
				this.advance();
			} else {
				break;
			}
		}

		const text = this.src.substring(start, this.pos);
		const kind: TokenKind = KEYWORDS[text] || 'IDENTIFIER';
		return {
			kind,
			text,
			location: this.makeLocation()
		};
	}

	private lexNumber(start: number): Token {
		const firstChar = this.src[start];

		// Check for hexadecimal
		if (firstChar === '0' && this.peek() === 'x') {
			this.advance(); // skip 'x'
			// NOTE: Toy CANNOT handle negative value because the original lexer uses C++ `isdigit()` to lex number token
			// https://github.com/llvm/llvm-project/blob/main/mlir/examples/toy/Ch7/include/toy/Lexer.h
			while (!this.isEOF() && /[0-9a-fA-F]/.test(this.peek()!)) {
				this.advance();
			}
			return {
				kind: 'NUMBER',
				text: this.src.substring(start, this.pos),
				location: this.makeLocation()
			};
		}

		// Decimal number
		while (!this.isEOF() && /[0-9]/.test(this.peek()!)) {
			this.advance();
		}

		// Check for fractional part
		if (this.peek() === '.' && this.peek(1) && /[0-9]/.test(this.peek(1)!)) {
			this.advance(); // skip '.'
			while (!this.isEOF() && /[0-9]/.test(this.peek()!)) {
				this.advance();
			}

			// Check for exponent
			if (this.peek() === 'e' || this.peek() === 'E') {
				this.advance();
				if (this.peek() === '+' || this.peek() === '-') {
					this.advance();
				}
				while (!this.isEOF() && /[0-9]/.test(this.peek()!)) {
					this.advance();
				}
			}
		}

		return {
			kind: 'NUMBER',
			text: this.src.substring(start, this.pos),
			location: this.makeLocation()
		};
	}

	tokenize(): Token {
		this.skipWhitespace();
		this.markTokenStart();

		if (this.isEOF()) {
			return {
				kind: 'EOF',
				text: '',
				location: this.makeLocation()
			};
		}

		const start = this.pos;
		const ch = this.advance();

		// Comment
		if (ch === '#') {
			return this.lexComment(start);
		}

		// Identifier or keyword
		if (/[a-zA-Z_]/.test(ch)) {
			return this.lexIdentifier(start);
		}

		// Number
		if (/[0-9]/.test(ch)) {
			return this.lexNumber(start);
		}

		// Single character tokens
		const singleCharKind = SINGLE_CHAR_TOKENS[ch];
		if (singleCharKind) {
			return {
				kind: singleCharKind,
				text: ch,
				location: this.makeLocation()
			};
		}

		// Unknown character
		return {
			kind: 'UNKNOWN',
			text: ch,
			location: this.makeLocation()
		};
	}
}

export function tokenizeAll(uri: string, src: string): Token[] {
	const tokens: Token[] = [];
	const tokenizer = new Tokenizer(uri, src);
	while (true) {
		const token = tokenizer.tokenize();
		tokens.push(token);
		if (token.kind === "EOF") {
			break;
		}
	}

	return tokens;
}
