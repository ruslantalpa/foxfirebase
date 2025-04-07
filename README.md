# commands to start the server

```
docker compose build
```

```
docker compose up -d
```

```
cp .env.example .env
```

```
npm install
```

```
npm run dev
```

```
open http://localhost:5173
```

# some benchmark results for core rust functions
```
parse request           time:   [12.737 µs 12.880 µs 13.019 µs]
generate query          time:   [15.580 µs 15.724 µs 15.853 µs]
```