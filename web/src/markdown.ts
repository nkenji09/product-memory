// Markdown → HTML renderer for project record descriptions
// (Tag.Description / VocabEntry.Description), built on markdown-it.
//
// Safety: markdown-it runs with `html: false`, so raw HTML in source text is
// never passed through — it's escaped like any other text token. The only
// tags this module's output can ever contain are the ones markdown-it (or
// the `highlight`/`link_open` overrides below) construct themselves around
// escaped/highlighted text. `validateLink` narrows link destinations to the
// same http(s)/mailto allowlist the previous hand-rolled renderer used
// (markdown-it's own default already blocks `javascript:`/`vbscript:`, but
// this keeps the allowlist explicit rather than relying on a blocklist).
// highlight.js's `highlight()` similarly only ever wraps its own escaped
// copy of the input in `<span class="hljs-*">` — it does not interpret the
// input as HTML. So: user-authored text can only ever become plain escaped
// text, a highlight.js span around escaped text, or one of the literal tags
// this module writes. This ships as part of the Vite bundle (no CDN
// dependency), so it renders identically in `scholia view` and in the
// self-contained `scholia export --html` output.
//
// Fenced ```mermaid blocks are rendered as `<pre class="mermaid">` holding
// the escaped-but-unrendered diagram source; `Markdown.tsx` turns those into
// diagrams after mount via a lazily-loaded mermaid (see its comment for why
// that split exists).

import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdownLang from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('go', go);
hljs.registerLanguage('golang', go);
// ini.js declares `aliases: ['toml']` itself (highlight.js ships no
// dedicated TOML grammar; INI's key=value/[section] syntax is the closest
// built-in match, so this is the grammar highlight.js's own docs point
// `toml` at) — registerLanguage wires that alias up automatically.
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdownLang);
hljs.registerLanguage('md', markdownLang);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
// rust.js declares `aliases: ['rs']` itself, so `rs` fences resolve too.
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
// typescript.js/javascript.js both declare aliases including 'jsx'/'tsx'
// (js/jsx/mjs/cjs and jsx/tsx/mts/cts respectively), so those fence
// languages already resolve via the two registrations below — no separate
// import needed. `react` isn't a real fence-language id either grammar
// declares, but authors write ```react for React/JSX snippets often enough
// to alias it explicitly onto the TypeScript grammar (handles both .jsx and
// .tsx-flavored React code, since TS is a superset).
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('react', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
// highlight.js ships no Vue-SFC grammar; XML's own `<script>`/`<style>` tag
// handling already sub-languages into javascript/css (see xml.js), so
// aliasing `vue` to the XML grammar highlights the template markup plus
// embedded script/style blocks reasonably without a dedicated dependency.
hljs.registerLanguage('vue', xml);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);

// Only these link schemes render as a clickable <a>; anything else (in
// particular `javascript:`/`data:`) falls back to markdown-it's default
// escaped-text handling for an invalid link.
const SAFE_URL = /^(https?:|mailto:)/i;

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
  highlight(code, lang) {
    if (lang === 'mermaid') {
      return `<pre class="mermaid">${md.utils.escapeHtml(code)}</pre>`;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code>${highlighted}</code></pre>`;
      } catch {
        // fall through to plain escaped output below
      }
    }
    return `<pre><code>${md.utils.escapeHtml(code)}</code></pre>`;
  },
});

md.validateLink = (url) => SAFE_URL.test(url);

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer');
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderMarkdown(source: string): string {
  if (!source || !source.trim()) return '';
  return md.render(source);
}
