# DNS input validation example

Import `validResolverAddress` from `src/dns-input.mjs` to validate IPv4 resolver input. The function accepts a string and returns a boolean. The example has no runtime dependencies and uses the MIT license.

Its tests cover IPv4 input syntax. Resolver configuration, IPv6, DNS transport, network reachability and leak prevention require additional implementation and tests before those capabilities can be claimed.

For a real feature, document installation, supported app shells and versions, exported interfaces, configuration, required privileges, dependencies, conflicts, rollback, and the tests required after integration into a host app. Include exact paths and commands that the integrating agent can follow.
