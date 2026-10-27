import math
import re
from typing import List, Optional
from lifeos.models.document import DocumentChunk


_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have",
    "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers",
    "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've",
    "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me",
    "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on",
    "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
    "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't",
    "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
    "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll",
    "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't",
    "what", "what's", "when", "when's", "where", "where's", "which", "while", "who",
    "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you",
    "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
}


def tokenize(text: str) -> List[str]:
    """Tokenize and normalize text into meaningful terms."""
    clean = re.sub(r"[^\w\s-]", " ", text.casefold())
    tokens = [t for t in clean.split() if len(t) >= 2 and t not in _STOPWORDS]
    return tokens


class BM25Retriever:
    """Production BM25 Okapi lexical retriever with exact-phrase boosting."""

    @staticmethod
    def rank_chunks(
        chunks: List[DocumentChunk],
        query: str,
        limit: int = 5,
        k1: float = 1.5,
        b: float = 0.75,
    ) -> List[DocumentChunk]:
        if not chunks or not query.strip():
            return []

        query_tokens = tokenize(query)
        if not query_tokens:
            query_tokens = [t.casefold() for t in query.split() if len(t) >= 2]
        if not query_tokens:
            return []

        clean_query_str = " ".join(query.casefold().split())

        # Document frequencies
        N = len(chunks)
        doc_lengths = [len(tokenize(c.content)) or 1 for c in chunks]
        avgdl = sum(doc_lengths) / N if N > 0 else 1.0

        # DF calculation
        df: dict[str, int] = {}
        chunk_token_counts: list[dict[str, int]] = []
        for c in chunks:
            tokens = tokenize(c.content)
            counts: dict[str, int] = {}
            for t in tokens:
                counts[t] = counts.get(t, 0) + 1
            chunk_token_counts.append(counts)
            for t in counts:
                df[t] = df.get(t, 0) + 1

        # Calculate scores
        scored: list[tuple[float, int, DocumentChunk]] = []
        for idx, chunk in enumerate(chunks):
            counts = chunk_token_counts[idx]
            doc_len = doc_lengths[idx]
            bm25_score = 0.0

            for q_term in query_tokens:
                if q_term not in counts:
                    continue
                tf = counts[q_term]
                n_q = df.get(q_term, 0)
                # BM25 IDF formulation
                idf = math.log((N - n_q + 0.5) / (n_q + 0.5) + 1.0)
                numerator = tf * (k1 + 1.0)
                denominator = tf + k1 * (1.0 - b + b * (doc_len / avgdl))
                bm25_score += idf * (numerator / denominator)

            # Exact phrase bonus: if the user's multi-word query appears verbatim
            content_lower = chunk.content.casefold()
            if len(query_tokens) > 1 and clean_query_str in content_lower:
                bm25_score += 3.0

            if bm25_score > 0.0:
                scored.append((bm25_score, -chunk.ordinal, chunk))

        scored.sort(reverse=True, key=lambda row: (row[0], row[1]))
        return [row[2] for row in scored[:limit]]


class EmbeddingProvider:
    """Provider-neutral interface for vector embeddings."""

    @staticmethod
    def is_available() -> bool:
        """Reports whether a real embedding provider is configured."""
        # When an external embedding endpoint (e.g. OpenAI/NVIDIA NeMo Embed) is added, configure here.
        # Currently default is False, so lexical BM25 is used safely without fake embeddings.
        return False

    @staticmethod
    async def embed_texts(texts: List[str]) -> Optional[List[List[float]]]:
        if not EmbeddingProvider.is_available():
            return None
        return None

