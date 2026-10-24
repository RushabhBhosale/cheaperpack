/** Inline critical CSS: one small block, no external stylesheet, no web fonts. */
export const CSS = `
:root{--ink:#16181d;--ink2:#3b414c;--muted:#626a78;--line:#e3e6eb;--bg:#fff;--soft:#f5f6f8;--accent:#b42318;--accent-ink:#8f1b11;--accent-soft:#fdeceb;--link:#0b5cad;--ok:#146c43;--warn-soft:#fff6e5;--warn:#8a5300;--r:12px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--link);text-underline-offset:.18em}a:hover{color:var(--accent-ink)}
h1,h2,h3{line-height:1.25;letter-spacing:-.01em;margin:0 0 .5em;text-wrap:balance}
h1{font-size:clamp(1.65rem,4.5vw,2.4rem)}h2{font-size:1.4rem;margin-top:2rem}h3{font-size:1.1rem}
p{margin:0 0 1em;text-wrap:pretty}ul,ol{padding-left:1.25rem}
.wrap{max-width:62rem;margin:0 auto;padding:0 1rem}
.skip{position:absolute;left:-999px;top:0;background:#fff;padding:.5rem 1rem;z-index:9}.skip:focus{left:.5rem;top:.5rem}
header.site{border-bottom:1px solid var(--line);background:#fff}
.bar{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.25rem;padding:.7rem 0}
.brand{font-weight:800;font-size:1.15rem;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:.5rem}
.brand i{width:1.4rem;height:1.4rem;border-radius:50%;background:var(--accent);display:inline-block;box-shadow:inset 0 0 0 .3rem var(--accent),inset 0 0 0 .5rem #fff}
nav.main{display:flex;flex-wrap:wrap;gap:.25rem 1rem;font-size:.95rem}nav.main a{color:var(--ink2);text-decoration:none;padding:.25rem 0}nav.main a:hover,nav.main a[aria-current]{color:var(--accent-ink);text-decoration:underline}
form.search{display:flex;gap:.4rem;margin-left:auto;min-width:min(100%,18rem)}
form.search input{flex:1;min-width:0;padding:.55rem .75rem;border:1px solid #c7ccd4;border-radius:8px;font:inherit;background:#fff}
button,.btn{display:inline-block;padding:.55rem 1rem;border:0;border-radius:8px;background:var(--accent);color:#fff;font:inherit;font-weight:650;cursor:pointer;text-decoration:none}button:hover,.btn:hover{background:var(--accent-ink);color:#fff}
main{padding:1.25rem 0 3rem;min-height:60vh}
.crumbs{font-size:.88rem;color:var(--muted);margin-bottom:1rem}.crumbs a{color:var(--muted)}
.lede{font-size:1.12rem;color:var(--ink2);max-width:44rem}
.meta{color:var(--muted);font-size:.92rem;margin:-.25rem 0 1rem}.meta a{color:var(--muted)}
.pill{display:inline-block;padding:.12rem .6rem;border-radius:999px;font-size:.78rem;font-weight:650;background:var(--accent-soft);color:var(--accent-ink);text-decoration:none;margin:0 .3rem .3rem 0}
.pill.cat{background:#e8f0fb;color:#0b4a8a}
.box{border:1px solid var(--line);border-radius:var(--r);padding:1rem 1.1rem;background:var(--soft);margin:1rem 0}
.alert{border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:8px;padding:.9rem 1rem;margin:1rem 0}
.alert strong{display:block;margin-bottom:.2rem}
dl.facts{display:grid;grid-template-columns:minmax(7rem,11rem) 1fr;gap:.55rem 1rem;margin:0}dl.facts dt{color:var(--muted);font-size:.92rem}dl.facts dd{margin:0}
@media(max-width:34rem){dl.facts{grid-template-columns:1fr;gap:.1rem}dl.facts dd{margin-bottom:.6rem}}
.cards{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));margin:0;padding:0;list-style:none}
.card{display:block;border:1px solid var(--line);border-radius:var(--r);padding:.9rem 1rem;color:var(--ink);text-decoration:none;background:#fff;height:100%}
.card:hover{border-color:var(--accent);background:#fffaf9}.card b{display:block;font-size:1rem;line-height:1.35;margin-bottom:.25rem}.card small{display:block;color:var(--muted);font-size:.84rem}.card p{font-size:.92rem;color:var(--ink2);margin:.4rem 0 0}
.list{list-style:none;padding:0;margin:0}.list li{border-top:1px solid var(--line);padding:.85rem 0}.list li:last-child{border-bottom:1px solid var(--line)}
.list a.t{font-weight:650;font-size:1.05rem;color:var(--ink);text-decoration:none}.list a.t:hover{color:var(--accent-ink);text-decoration:underline}
.list p{margin:.25rem 0 0;font-size:.93rem;color:var(--ink2)}.list small{color:var(--muted)}
.gallery{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fill,minmax(10rem,1fr));margin:.5rem 0}
.gallery figure{margin:0}.gallery .ph{aspect-ratio:4/3;background:var(--soft);border:1px solid var(--line);border-radius:8px;overflow:hidden}.gallery img{width:100%;height:100%;object-fit:contain;display:block}.gallery figcaption{font-size:.8rem;color:var(--muted);margin-top:.2rem}
details{border-top:1px solid var(--line);padding:.7rem 0}details:last-of-type{border-bottom:1px solid var(--line)}summary{cursor:pointer;font-weight:650}details p{margin:.5rem 0 0;color:var(--ink2)}
.pager{display:flex;justify-content:space-between;gap:1rem;margin:1.5rem 0}.pager a{font-weight:650}
.cols{display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}
.tags{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0 1rem}.tags a{border:1px solid var(--line);border-radius:999px;padding:.25rem .8rem;text-decoration:none;font-size:.92rem;color:var(--ink2);background:#fff}.tags a:hover{border-color:var(--accent);color:var(--accent-ink)}
.hero{background:linear-gradient(180deg,#fff5f4,#fff);border-bottom:1px solid var(--line);padding:2rem 0 1.6rem}
.hero form{display:flex;gap:.5rem;max-width:34rem;margin:1rem 0 .5rem}.hero input{flex:1;min-width:0;padding:.75rem 1rem;border:1px solid #c7ccd4;border-radius:10px;font:inherit}
.disclaimer{font-size:.85rem;color:var(--muted)}
.ad{min-height:280px;margin:1.5rem 0;text-align:center;background:transparent;overflow:hidden}
.ad small{display:block;color:var(--muted);font-size:.7rem;text-transform:uppercase;letter-spacing:.06em}
footer.site{border-top:1px solid var(--line);background:var(--soft);padding:1.5rem 0 2rem;font-size:.92rem;color:var(--ink2)}
footer.site .cols{margin-bottom:1rem}footer.site h2{font-size:.95rem;margin:0 0 .4rem}footer.site ul{list-style:none;padding:0;margin:0}footer.site li{margin:.2rem 0}footer.site a{color:var(--ink2)}
.prose{max-width:44rem}.prose h2{margin-top:2rem}.prose li{margin:.3rem 0}
.stat{display:flex;gap:1.5rem;flex-wrap:wrap;margin:1rem 0}.stat div{min-width:7rem}.stat b{display:block;font-size:1.6rem;line-height:1.1}.stat span{color:var(--muted);font-size:.85rem}
table{border-collapse:collapse;width:100%;font-size:.95rem}th,td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--line)}
@media(prefers-color-scheme:dark){:root{--ink:#eceef2;--ink2:#c5cad3;--muted:#98a0ad;--line:#2b303a;--bg:#101318;--soft:#171b22;--accent:#e5483b;--accent-ink:#ff8277;--accent-soft:#2b1816;--link:#7db7ff}body{color-scheme:dark}header.site,.card,.chip,.tags a,form.search input,.hero input{background:#171b22;color:var(--ink)}.hero{background:linear-gradient(180deg,#1d1517,var(--bg))}.pill.cat{background:#16283d;color:#9cc8ff}.card:hover{background:#1b2028}button,.btn{color:#fff}}
`;
