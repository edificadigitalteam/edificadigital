export function withTimeout(promise, milliseconds, message) {
  let timer
  const timeout = new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error(message)), milliseconds) })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => window.clearTimeout(timer))
}
