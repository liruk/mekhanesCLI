// Explicit ruby only: bare 《...》 remains ordinary prose.
const rubyPattern = /[|｜]([^|｜《》\r\n]+)《([^|｜《》\r\n]+)》/gu;

function rubyHtml(base, reading, escape) {
  return `<ruby>${escape(base)}<rp>（</rp><rt>${escape(reading)}</rt><rp>）</rp></ruby>`;
}

export function renderRubyText(source, escape) {
  let html = '';
  let position = 0;
  for (const match of source.matchAll(rubyPattern)) {
    html += escape(source.slice(position, match.index));
    html += rubyHtml(match[1], match[2], escape);
    position = match.index + match[0].length;
  }
  return html + escape(source.slice(position));
}

export function rubyPlugin(md) {
  // Work on prose tokens, never generated HTML, code, or link destinations.
  // Run before text_join so Markdown-escaped pipes remain literal.
  md.core.ruler.after('inline', 'explicit_ruby', state => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue;
      block.children = block.children.flatMap(token => {
        if (token.type !== 'text') return [token];
        const result = [];
        let position = 0;
        const appendText = content => {
          if (!content) return;
          const part = new state.Token('text', '', 0);
          part.content = content;
          part.level = token.level;
          result.push(part);
        };
        for (const match of token.content.matchAll(rubyPattern)) {
          appendText(token.content.slice(position, match.index));
          const ruby = new state.Token('explicit_ruby', 'ruby', 0);
          ruby.content = match[1];
          ruby.meta = { reading: match[2] };
          ruby.level = token.level;
          result.push(ruby);
          position = match.index + match[0].length;
        }
        appendText(token.content.slice(position));
        return result;
      });
    }
  });
  md.renderer.rules.explicit_ruby = (tokens, index) =>
    rubyHtml(tokens[index].content, tokens[index].meta.reading, md.utils.escapeHtml);
}
