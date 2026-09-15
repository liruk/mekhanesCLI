import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { renderRubyText, rubyPlugin } from '../scripts/ruby.mjs';

const md = new MarkdownIt({ html: false, linkify: true }).use(rubyPlugin);
const renderText = source => renderRubyText(source, md.utils.escapeHtml);
const shiki = '<ruby>此希<rp>（</rp><rt>シキ</rt><rp>）</rp></ruby>';
const kotoori = '<ruby>琴織<rp>（</rp><rt>コトオリ</rt><rp>）</rp></ruby>';

test('text manuscripts render adjacent ruby while preserving indentation and line endings', () => {
  assert.equal(renderText('　|琴織《コトオリ》|此希《シキ》。\r\n\r\n　次の行。'),
    `　${kotoori}${shiki}。\r\n\r\n　次の行。`);
});

test('whole phrases, full-width markers, and dot readings are supported', () => {
  assert.equal(renderText('これは｜有り得ない《・・・・・》。'),
    'これは<ruby>有り得ない<rp>（</rp><rt>・・・・・</rt><rp>）</rp></ruby>。');
  assert.equal(renderText('|ルビを乗せたい文章《ルビ》'),
    '<ruby>ルビを乗せたい文章<rp>（</rp><rt>ルビ</rt><rp>）</rp></ruby>');
});

test('bare brackets, pipes and malformed ruby remain literal in both formats', () => {
  for (const source of ['《ケイオスディーラー》', 'A | B', '|本文《》', '|《ルビ》', '|本文《未完', '|本\n文《ルビ》', '|本文《ル\nビ》']) {
    assert.equal(renderText(source), source);
    assert.equal(md.renderInline(source), source);
  }
  assert.equal(renderText('|未完 |此希《シキ》'), `|未完 ${shiki}`);
});

test('plain text and both ruby components escape HTML instead of enabling markup', () => {
  assert.equal(renderText('<script>x</script> |<b>&"《<img>&"》'),
    '&lt;script&gt;x&lt;/script&gt; <ruby>&lt;b&gt;&amp;&quot;<rp>（</rp><rt>&lt;img&gt;&amp;&quot;</rt><rp>）</rp></ruby>');
  const html = md.renderInline('|<script>alert(1)</script>《<img src=x onerror=alert(1)>》');
  assert.ok(!html.includes('<script>') && !html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('Markdown renders ruby within paragraphs, headings, emphasis and link labels', () => {
  assert.equal(md.render('　|琴織《コトオリ》|此希《シキ》。'), `<p>　${kotoori}${shiki}。</p>\n`);
  assert.equal(md.render('# ｜此希《シキ》'), `<h1>${shiki}</h1>\n`);
  assert.equal(md.renderInline('**|此希《シキ》**'), `<strong>${shiki}</strong>`);
  assert.equal(md.renderInline('[|此希《シキ》](/works/)'), `<a href="/works/">${shiki}</a>`);
});

test('Markdown code, escaped markers and link destinations stay unchanged', () => {
  assert.equal(md.renderInline('`|此希《シキ》`'), '<code>|此希《シキ》</code>');
  assert.equal(md.render('```text\n|此希《シキ》\n```'), '<pre><code class="language-text">|此希《シキ》\n</code></pre>\n');
  assert.equal(md.renderInline('\\|此希《シキ》'), '|此希《シキ》');
  const source = '[移動](/path/|此希《シキ》)';
  assert.equal(md.renderInline(source), new MarkdownIt().renderInline(source));
});

test('Markdown tables retain column structure and accept full-width ruby markers', () => {
  const html = md.render('| 名前 | 説明 |\n| --- | --- |\n| ｜此希《シキ》 | 登場人物 |');
  assert.equal((html.match(/<td>/g) || []).length, 2);
  assert.ok(html.includes(`<td>${shiki}</td>`));
});
