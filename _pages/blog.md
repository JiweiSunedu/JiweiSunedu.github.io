---
layout: jiwei-page
permalink: /blog/
title: Blogs | 博客
title_en: Blogs
title_zh: 博客
nav: false
---

<div class="post-list">
{%- for post in site.posts %}
  {%- assign summary = post.description | default: post.excerpt | strip_html | strip_newlines | truncatewords: 26 %}
  <article class="post-item">
    <time class="post-date" datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %Y" }}</time>
    <div class="post-body">
      <h2 class="post-title"><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></h2>
      {%- if summary != '' %}<p class="post-summary">{{ summary }}</p>{% endif %}
    </div>
  </article>
{%- endfor %}
</div>
