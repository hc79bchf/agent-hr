/**
 * MarkdownPreview component for rendering markdown content.
 * Uses a simple regex-based parser for basic markdown rendering.
 */

import { useMemo } from 'react';

/**
 * MarkdownPreview component props.
 */
interface MarkdownPreviewProps {
  /** Markdown content to render */
  content: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Simple markdown to HTML converter.
 * Supports: headers, bold, italic, code blocks, inline code, links, lists.
 */
function parseMarkdown(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```...```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto text-sm my-2"><code>$2</code></pre>'
  );

  // Inline code (`...`)
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">$1</code>'
  );

  // Headers (# - ######)
  html = html.replace(
    /^###### (.+)$/gm,
    '<h6 class="text-sm font-semibold text-gray-900 mt-3 mb-1">$1</h6>'
  );
  html = html.replace(
    /^##### (.+)$/gm,
    '<h5 class="text-sm font-semibold text-gray-900 mt-3 mb-1">$1</h5>'
  );
  html = html.replace(
    /^#### (.+)$/gm,
    '<h4 class="text-base font-semibold text-gray-900 mt-4 mb-2">$1</h4>'
  );
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h3>'
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="text-xl font-bold text-gray-900 mt-5 mb-2">$1</h2>'
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 class="text-2xl font-bold text-gray-900 mt-6 mb-3">$1</h1>'
  );

  // Bold (**...** or __...__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong class="font-semibold">$1</strong>');

  // Italic (*...* or _..._)
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em class="italic">$1</em>');

  // Links ([text](url))
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-indigo-600 hover:text-indigo-500 underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Unordered lists (- or *)
  html = html.replace(
    /^[\-\*] (.+)$/gm,
    '<li class="ml-4 list-disc text-gray-700">$1</li>'
  );

  // Ordered lists (1. 2. etc.)
  html = html.replace(
    /^\d+\. (.+)$/gm,
    '<li class="ml-4 list-decimal text-gray-700">$1</li>'
  );

  // Wrap consecutive list items in ul/ol
  html = html.replace(
    /(<li class="ml-4 list-disc[^>]*>.*?<\/li>\n?)+/g,
    '<ul class="my-2">$&</ul>'
  );
  html = html.replace(
    /(<li class="ml-4 list-decimal[^>]*>.*?<\/li>\n?)+/g,
    '<ol class="my-2">$&</ol>'
  );

  // Blockquotes (>)
  html = html.replace(
    /^&gt; (.+)$/gm,
    '<blockquote class="border-l-4 border-gray-300 pl-4 py-1 my-2 text-gray-600 italic">$1</blockquote>'
  );

  // Horizontal rules (---, ***, ___)
  html = html.replace(
    /^(---|\*\*\*|___)$/gm,
    '<hr class="my-4 border-gray-300" />'
  );

  // Line breaks (double newline = paragraph)
  html = html.replace(/\n\n/g, '</p><p class="my-2 text-gray-700">');

  // Single line breaks
  html = html.replace(/\n/g, '<br />');

  // Wrap in paragraph tags
  html = '<p class="my-2 text-gray-700">' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p class="my-2 text-gray-700"><\/p>/g, '');
  html = html.replace(/<p class="my-2 text-gray-700">(<h[1-6]|<ul|<ol|<pre|<blockquote|<hr)/g, '$1');
  html = html.replace(/(<\/h[1-6]>|<\/ul>|<\/ol>|<\/pre>|<\/blockquote>|<hr[^>]*\/>)<\/p>/g, '$1');

  return html;
}

/**
 * MarkdownPreview component.
 * Renders markdown content as styled HTML.
 */
export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  const html = useMemo(() => parseMarkdown(content), [content]);

  if (!content) {
    return (
      <div className={`text-gray-400 italic text-sm ${className}`}>
        No content to preview
      </div>
    );
  }

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
