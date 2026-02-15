import { tokenize, TokenKind } from './lexer';

describe('tokenize', () => {
	const uri = 'test://test.toy';

	it('should tokenize empty string', () => {
		const tokens = tokenize(uri, '');
		expect(tokens).toHaveLength(1);
		expect(tokens[0].kind).toBe('EOF');
	});

	it('should tokenize whitespace only', () => {
		const tokens = tokenize(uri, '   \n\t  ');
		expect(tokens).toHaveLength(1);
		expect(tokens[0].kind).toBe('EOF');
	});

	it('should tokenize comments', () => {
		const tokens = tokenize(uri, '# this is a comment\n');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].kind).toBe('COMMENT');
		expect(tokens[0].text).toBe('# this is a comment');
		expect(tokens[1].kind).toBe('EOF');
	});

	it('should tokenize comment without newline', () => {
		const tokens = tokenize(uri, '# comment at end');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].kind).toBe('COMMENT');
		expect(tokens[0].text).toBe('# comment at end');
		expect(tokens[1].kind).toBe('EOF');
	});

	it('should tokenize single number', () => {
		const tokens = tokenize(uri, '123');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].kind).toBe('NUMBER');
		expect(tokens[0].text).toBe('123');
		expect(tokens[1].kind).toBe('EOF');
	});

	it('should tokenize hexadecimal number', () => {
		const tokens = tokenize(uri, '0x1a2f');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].kind).toBe('NUMBER');
		expect(tokens[0].text).toBe('0x1a2f');
		expect(tokens[1].kind).toBe('EOF');
	});

	it('should tokenize floating point number', () => {
		const tokens = tokenize(uri, '123.456');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].kind).toBe('NUMBER');
		expect(tokens[0].text).toBe('123.456');
		expect(tokens[1].kind).toBe('EOF');
	});

	it('should tokenize identifier', () => {
		const tokens = tokenize(uri, 'foo_bar123');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].kind).toBe('IDENTIFIER');
		expect(tokens[0].text).toBe('foo_bar123');
		expect(tokens[1].kind).toBe('EOF');
	});

	it('should tokenize keywords', () => {
		const keywords: TokenKind[] = ['return', 'var', 'def'];
		keywords.forEach(keyword => {
			const tokens = tokenize(uri, keyword);
			expect(tokens).toHaveLength(2);
			expect(tokens[0].kind).toBe(keyword);
			expect(tokens[0].text).toBe(keyword);
			expect(tokens[1].kind).toBe('EOF');
		});
	});

	it('should tokenize punctuation', () => {
		const punctuations: [string, TokenKind][] = [
			[';', ';'],
			['(', '('],
			[')', ')'],
			['{', '{'],
			['}', '}'],
			['[', '['],
			[']', ']'],
			['<', '<'],
			['>', '>'],
			['=', '='],
			[',', ','],
		];
		punctuations.forEach(([text, kind]) => {
			const tokens = tokenize(uri, text);
			expect(tokens).toHaveLength(2);
			expect(tokens[0].kind).toBe(kind);
			expect(tokens[0].text).toBe(text);
			expect(tokens[1].kind).toBe('EOF');
		});
	});

	it('should tokenize operators', () => {
		const operators = ['+', '-', '*', '/'];
		operators.forEach(op => {
			const tokens = tokenize(uri, op);
			expect(tokens).toHaveLength(2);
			expect(tokens[0].kind).toBe(op);
			expect(tokens[0].text).toBe(op);
			expect(tokens[1].kind).toBe('EOF');
		});
	});

	it('should tokenize simple expression', () => {
		const tokens = tokenize(uri, 'var x = 42;');
		expect(tokens).toHaveLength(6);
		expect(tokens[0]).toMatchObject({ kind: 'var', text: 'var' });
		expect(tokens[1]).toMatchObject({ kind: 'IDENTIFIER', text: 'x' });
		expect(tokens[2]).toMatchObject({ kind: '=', text: '=' });
		expect(tokens[3]).toMatchObject({ kind: 'NUMBER', text: '42' });
		expect(tokens[4]).toMatchObject({ kind: ';', text: ';' });
		expect(tokens[5]).toMatchObject({ kind: 'EOF' });
	});

	it('should tokenize arithmetic expression', () => {
		const tokens = tokenize(uri, 'a + b * 3');
		expect(tokens).toHaveLength(6);
		expect(tokens[0]).toMatchObject({ kind: 'IDENTIFIER', text: 'a' });
		expect(tokens[1]).toMatchObject({ kind: '+', text: '+' });
		expect(tokens[2]).toMatchObject({ kind: 'IDENTIFIER', text: 'b' });
		expect(tokens[3]).toMatchObject({ kind: '*', text: '*' });
		expect(tokens[4]).toMatchObject({ kind: 'NUMBER', text: '3' });
		expect(tokens[5]).toMatchObject({ kind: 'EOF' });
	});

	it('should tokenize function definition', () => {
		const tokens = tokenize(uri, 'def foo(x, y) { return x + y; }');
		expect(tokens[0]).toMatchObject({ kind: 'def', text: 'def' });
		expect(tokens[1]).toMatchObject({ kind: 'IDENTIFIER', text: 'foo' });
		expect(tokens[2]).toMatchObject({ kind: '(', text: '(' });
		expect(tokens[3]).toMatchObject({ kind: 'IDENTIFIER', text: 'x' });
		expect(tokens[4]).toMatchObject({ kind: ',', text: ',' });
		expect(tokens[5]).toMatchObject({ kind: 'IDENTIFIER', text: 'y' });
		expect(tokens[6]).toMatchObject({ kind: ')', text: ')' });
		expect(tokens[7]).toMatchObject({ kind: '{', text: '{' });
		expect(tokens[8]).toMatchObject({ kind: 'return', text: 'return' });
		expect(tokens[9]).toMatchObject({ kind: 'IDENTIFIER', text: 'x' });
		expect(tokens[10]).toMatchObject({ kind: '+', text: '+' });
		expect(tokens[11]).toMatchObject({ kind: 'IDENTIFIER', text: 'y' });
		expect(tokens[12]).toMatchObject({ kind: ';', text: ';' });
		expect(tokens[13]).toMatchObject({ kind: '}', text: '}' });
		expect(tokens[14]).toMatchObject({ kind: 'EOF' });
	});

	it('should handle multiple comments and whitespace', () => {
		const source = `
# comment 1
var x = 1; # inline comment
# comment 2
var y = 2;
`;
		const tokens = tokenize(uri, source);
		const nonEOFTokens = tokens.filter(t => t.kind !== 'EOF');
		expect(nonEOFTokens).toHaveLength(13); // 3 comments + 10 other tokens
		expect(nonEOFTokens[0]).toMatchObject({ kind: 'COMMENT', text: '# comment 1' });
		expect(nonEOFTokens[1]).toMatchObject({ kind: 'var', text: 'var' });
		expect(nonEOFTokens[2]).toMatchObject({ kind: 'IDENTIFIER', text: 'x' });
		expect(nonEOFTokens[3]).toMatchObject({ kind: '=', text: '=' });
		expect(nonEOFTokens[4]).toMatchObject({ kind: 'NUMBER', text: '1' });
		expect(nonEOFTokens[5]).toMatchObject({ kind: ';', text: ';' });
		expect(nonEOFTokens[6]).toMatchObject({ kind: 'COMMENT', text: '# inline comment' });
		expect(nonEOFTokens[7]).toMatchObject({ kind: 'COMMENT', text: '# comment 2' });
		expect(nonEOFTokens[8]).toMatchObject({ kind: 'var', text: 'var' });
	});

	describe('location information', () => {
		it('should provide correct location for single token', () => {
			const tokens = tokenize(uri, 'foo');
			expect(tokens[0].location).toMatchObject({
				uri,
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 3 }
				}
			});
		});

		it('should provide correct location for tokens on same line', () => {
			const tokens = tokenize(uri, 'var x = 42;');
			// var: positions 0-3
			expect(tokens[0].location.range).toMatchObject({
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 }
			});
			// x: positions 4-5
			expect(tokens[1].location.range).toMatchObject({
				start: { line: 0, character: 4 },
				end: { line: 0, character: 5 }
			});
			// =: positions 6-7
			expect(tokens[2].location.range).toMatchObject({
				start: { line: 0, character: 6 },
				end: { line: 0, character: 7 }
			});
			// 42: positions 8-10
			expect(tokens[3].location.range).toMatchObject({
				start: { line: 0, character: 8 },
				end: { line: 0, character: 10 }
			});
			// ;: positions 10-11
			expect(tokens[4].location.range).toMatchObject({
				start: { line: 0, character: 10 },
				end: { line: 0, character: 11 }
			});
		});

		it('should provide correct location for tokens on multiple lines', () => {
			const source = 'var x = 1;\nvar y = 2;';
			const tokens = tokenize(uri, source);

			// First line: var x = 1;
			expect(tokens[0].location.range).toMatchObject({
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 }
			});

			// Second line: var y = 2;
			// var: after newline at position 11
			expect(tokens[5].location.range).toMatchObject({
				start: { line: 1, character: 0 },
				end: { line: 1, character: 3 }
			});
			// y: position 4 on line 1
			expect(tokens[6].location.range).toMatchObject({
				start: { line: 1, character: 4 },
				end: { line: 1, character: 5 }
			});
		});

		it('should provide correct location for comment', () => {
			const tokens = tokenize(uri, '# this is a comment');
			expect(tokens[0].location.range).toMatchObject({
				start: { line: 0, character: 0 },
				end: { line: 0, character: 19 }
			});
		});

		it('should provide correct location for inline comment', () => {
			const source = 'var x = 1; # comment';
			const tokens = tokenize(uri, source);

			// ;: position 9-10
			expect(tokens[4].location.range).toMatchObject({
				start: { line: 0, character: 9 },
				end: { line: 0, character: 10 }
			});

			// comment: positions 11-20
			expect(tokens[5].location.range).toMatchObject({
				start: { line: 0, character: 11 },
				end: { line: 0, character: 20 }
			});
		});

		it('should provide correct location for number literals', () => {
			// Integer
			const tokens1 = tokenize(uri, '123');
			expect(tokens1[0].location.range).toMatchObject({
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 }
			});

			// Float
			const tokens2 = tokenize(uri, '123.456');
			expect(tokens2[0].location.range).toMatchObject({
				start: { line: 0, character: 0 },
				end: { line: 0, character: 7 }
			});

			// Hex
			const tokens3 = tokenize(uri, '0x1a2f');
			expect(tokens3[0].location.range).toMatchObject({
				start: { line: 0, character: 0 },
				end: { line: 0, character: 6 }
			});
		});

		it('should provide correct location with leading whitespace', () => {
			const tokens = tokenize(uri, '   var x = 1;');
			// var: positions 3-6 (after 3 spaces)
			expect(tokens[0].location.range).toMatchObject({
				start: { line: 0, character: 3 },
				end: { line: 0, character: 6 }
			});
		});

		it('should provide correct location for multiline code', () => {
			const source = `def foo() {
  return 42;
}`;
			const tokens = tokenize(uri, source);

			// def: line 0, positions 0-3
			expect(tokens[0].location.range).toMatchObject({
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 }
			});

			// return: line 1, positions 2-8 (with 2 space indent)
			expect(tokens[5].location.range).toMatchObject({
				start: { line: 1, character: 2 },
				end: { line: 1, character: 8 }
			});

			// }: line 2, position 0
			expect(tokens[8].location.range).toMatchObject({
				start: { line: 2, character: 0 },
				end: { line: 2, character: 1 }
			});
		});
	});
});
