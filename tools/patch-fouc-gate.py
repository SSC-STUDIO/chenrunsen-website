#!/usr/bin/env python3
"""Insert FOUC blank-paper gate into live static HTML heads. Idempotent."""

import pathlib
import sys

MARKER = "data-fouc-gate"

SNIPPET = r'''<!-- FOUC gate: first paint is blank paper, never unstyled markup -->
<style data-fouc-gate>
html{background-color:#f4ead8}
html.theme-contrasted{background-color:#0e1412}
html:not(.is-css-ready) body{visibility:hidden;opacity:0}
</style>
<script data-fouc-gate>
(function(){
  var root=document.documentElement;
  var done=false;
  var domReady=document.readyState!=="loading";
  function reveal(){
    if(done)return;
    done=true;
    root.classList.add("is-css-ready");
  }
  function siteLinks(){
    return Array.prototype.filter.call(
      document.querySelectorAll('link[rel="stylesheet"]'),
      function(link){
        return (link.getAttribute("href")||"").indexOf("/_astro/")!==-1;
      }
    );
  }
  function allComplete(links){
    if(!links.length)return false;
    for(var i=0;i<links.length;i++){
      try{if(!links[i].sheet)return false;}catch(e){return false;}
    }
    return true;
  }
  function tryReveal(){
    if(!domReady)return;
    if(allComplete(siteLinks()))reveal();
  }
  function bind(){
    var links=siteLinks();
    for(var i=0;i<links.length;i++){
      if(links[i].getAttribute("data-fouc-armed")==="1")continue;
      links[i].setAttribute("data-fouc-armed","1");
      links[i].addEventListener("load",tryReveal);
      links[i].addEventListener("error",tryReveal);
    }
    tryReveal();
  }
  var mo=new MutationObserver(bind);
  mo.observe(root,{childList:true,subtree:true});
  bind();
  document.addEventListener("DOMContentLoaded",function(){
    domReady=true;
    bind();
    try{mo.disconnect();}catch(e){}
  });
  setTimeout(reveal,3500);
})();
</script>
<noscript data-fouc-gate><style>/* no JS: keep blank paper; avoid unstyled flash */</style></noscript>
'''

# Also ensure theme script sets background when present
BG_NEEDLE = "metas[i].setAttribute('content', color)"
BG_ALT_NEEDLE = 'metas[i].setAttribute("content", color)'
BG_INJECT = """
          try {
            root.style.backgroundColor = color
          } catch (e) {}
"""


def patch_theme_bg(html: str) -> str:
    if "root.style.backgroundColor = color" in html:
        return html
    for needle in (BG_NEEDLE, BG_ALT_NEEDLE):
        if needle in html:
            return html.replace(needle, needle + BG_INJECT, 1)
    return html


def patch_file(path: pathlib.Path) -> str:
    html = path.read_text(encoding="utf-8")
    if MARKER in html:
        return "skip"

    # Insert right after charset meta (present on every page)
    anchors = [
        '<meta charset="utf-8">',
        "<meta charset=\"utf-8\" />",
        "<meta charset='utf-8'>",
    ]
    for anchor in anchors:
        if anchor in html:
            html = html.replace(anchor, anchor + SNIPPET, 1)
            html = patch_theme_bg(html)
            path.write_text(html, encoding="utf-8")
            return "patched"

    return "no-anchor"


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/var/www/chenrunsen-site")
    counts = {"patched": 0, "skip": 0, "no-anchor": 0}
    for path in sorted(root.rglob("*.html")):
        status = patch_file(path)
        counts[status] = counts.get(status, 0) + 1
        print(f"{status}\t{path}")
    print("---")
    print(counts)
    return 0 if counts["no-anchor"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
