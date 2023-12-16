import { useState, useEffect } from "react";
import useStable from "./useStable";
import { useMutex } from "./mutex";

const OLD_TOKEN = (prevToken) => ({ iterator: prevToken.iterator });

/**
 * @template T
 * @typedef {{
 * done: boolean,
 * error?: Error,
 * loading: boolean,
 * loadMore: () => void,
 * value: T[],
 * }} UseIterator<T>
 */
/**
 * @template T
 * @param {AsyncGenerator<T[],T[],void>} iterator
 * @returns {UseIterator<T>}
 */
export default function useIterator(iterator) {
  const [refreshToken, refresh] = useState({ token: 0, iterator });

  const loadMore = useStable(() => refresh(OLD_TOKEN));
  // The results accumulated from the iterator
  const [results, setResults] = useState({
    done: false,
    error: null,
    loading: false,
    loadMore,
    value: [],
  });
  useEffect(() => {
    setResults({
      done: false,
      error: null,
      loading: false,
      loadMore,
      value: [],
    });
    refresh({ iterator });
  }, [iterator, loadMore]);

  const isRefreshStillValid = useStable(
    (e) => refreshToken.iterator === e.iterator || (refresh(OLD_TOKEN) && false)
  );

  const doUpdate = useMutex(async () => {
    if (results.done) return;
    const x = refreshToken;
    setResults({ ...results, loading: true });
    try {
      const { done, value } = await iterator.next();
      if (isRefreshStillValid(x))
        setResults({
          done,
          error: false,
          loading: false,
          loadMore,
          value: results.value.concat(value ?? []),
        });
    } catch (e) {
      console.error(e);
      if (isRefreshStillValid(x))
        setResults({
          done: false,
          error: e,
          loading: false,
          loadMore,
          value: results.value,
        });
    }
  });
  useEffect(() => {
    doUpdate();
  }, [refreshToken, doUpdate]);

  return results;
}
