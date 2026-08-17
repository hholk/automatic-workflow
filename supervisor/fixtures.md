# Supervisor simulation fixtures

1. Tiny fix: ordinary low-risk work → continue without Sol.
2. Productive long debug: same red failure, changed hypothesis/evidence → continue.
3. True stall: unchanged hypothesis/evidence → nudge, then reframe.
4. Self Sol request: valid `type: sol` request → Sol.
5. Missing context: context blockage plus Sol request → context before Sol.
6. Network/rate-limit failure: transient infrastructure failure → continue without reasoning.
7. High-risk/protected work: high risk, protected, destructive, irreversible, or human gate → human gate.
