# Deployment Notes

This app uses `BrowserRouter`, so production hosting must serve `index.html`
for client routes such as `/app`, `/app/analysis`, `/app/offline`, and
`/app/reports`.

Static hosts that support Netlify-style redirects can use `public/_redirects`:

```txt
/app/* /index.html 200
```

For nginx, add a fallback like:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
