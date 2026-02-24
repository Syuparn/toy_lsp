import { Location } from 'vscode-languageserver';
import { Token, Tokenizer, TokenKind } from './lexer';

export interface Diagnostic {
	location: Location;
	message: string;
};

export class Parser {
	curToken: Token;
	peekToken: Token;
	diagnostics: Diagnostic[];

	constructor(
		public readonly tokenizer: Tokenizer,
	) {
		this.curToken = tokenizer.tokenize();
		this.peekToken = tokenizer.tokenize();
		this.diagnostics = [];
	}

	match(tokenKinds: TokenKind[]) {
		return tokenKinds.includes(this.peekToken.kind);
	}

	assign(tokenKinds: TokenKind[]) {
		// consume token if kind is matched
		if (tokenKinds.includes(this.peekToken.kind)) {
			this.curToken = this.peekToken;
			this.peekToken = this.tokenizer.tokenize();
		}
	}

	expect(tokenKinds: TokenKind[], errMessage: string) {
		// add diagnostic if kind is not matched
		if (!tokenKinds.includes(this.peekToken.kind)) {
			this.diagnostics.push({
				location: this.curToken.location,
				message: errMessage,
			});
			return;
		}

		// consume the expected token
		this.curToken = this.peekToken;
		this.peekToken = this.tokenizer.tokenize();
	}

	// TODO: parseNumber
	// TODO: parseVariable
	// TODO: parseLiteral
}
