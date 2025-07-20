-- Example tracked pairs for XRPL DEX offer tracker
INSERT INTO tracked_pairs (taker_gets_currency, taker_gets_issuer, taker_pays_currency, taker_pays_issuer, active)
VALUES
  ('XRP', NULL, 'USD', 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', TRUE),
  ('XRP', NULL, 'EUR', 'rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1', TRUE),
  ('XRP', NULL, 'RLUSD', 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', TRUE), --test net
  ('XRP', NULL, 'RLUSD', 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De', TRUE), --main net
  ('XRP', NULL, 'USDC', 'rHuGNhqTG32mfmAvWA8hUyWRLV3tCSwKQt', TRUE), --test net
  ('XRP', NULL, 'USDC', 'rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE', TRUE), --main net
  ('USD', 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', 'EUR', 'rU6K7V3Po4snVhBBaU29sesqs2qTQJWDw1', TRUE); 