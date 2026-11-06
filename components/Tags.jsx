import Link from 'next/link';

function tagHref(basePath, tag) {
  return `${basePath}?tag=${encodeURIComponent(tag)}`;
}

export function TagChips({ tags = [], hrefBase }) {
  if (tags.length === 0) return null;

  return (
    <div className="tag-row" aria-label="Tags">
      {tags.map((tag) =>
        hrefBase ? (
          <Link
            className="tag-chip link"
            href={tagHref(hrefBase, tag)}
            key={tag}
          >
            {tag}
          </Link>
        ) : (
          <span className="tag-chip" key={tag}>
            {tag}
          </span>
        ),
      )}
    </div>
  );
}

export function TagFilter({ tags = [], activeTag = '', basePath }) {
  const options =
    activeTag && !tags.includes(activeTag) ? [activeTag, ...tags] : tags;
  if (options.length === 0) return null;

  return (
    <nav className="tag-filter" aria-label="Filtrar por tag">
      <span className="tag-filter-label">Filtrar por tag</span>
      {activeTag ? (
        <Link className="tag-chip link" href={basePath}>
          Todas
        </Link>
      ) : (
        <span className="tag-chip active">Todas</span>
      )}
      {options.map((tag) =>
        tag === activeTag ? (
          <span className="tag-chip active" key={tag} aria-current="page">
            {tag}
          </span>
        ) : (
          <Link
            className="tag-chip link"
            href={tagHref(basePath, tag)}
            key={tag}
          >
            {tag}
          </Link>
        ),
      )}
    </nav>
  );
}
