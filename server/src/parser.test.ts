import { Parser } from './parser';
import { Tokenizer } from './lexer';

describe('tokens', () => {
	const uri = 'test://test.toy';

	it('initialize current and peek tokens', () => {
		const tokenizer = new Tokenizer(uri, "1 + 2");
		const parser = new Parser(tokenizer);
		expect(parser.curToken.text).toBe("1");
		expect(parser.peekToken.text).toBe("+");
	});

	it('when peekToken index out of range', () => {
		const tokenizer = new Tokenizer(uri, "1");
		const parser = new Parser(tokenizer);
		expect(parser.curToken.text).toBe("1");
		expect(parser.peekToken.kind).toBe("EOF");
	});

	it('when curToken index out of range', () => {
		const tokenizer = new Tokenizer(uri, "");
		const parser = new Parser(tokenizer);
		expect(parser.curToken.kind).toBe("EOF");
		expect(parser.peekToken.kind).toBe("EOF");
	});
});
