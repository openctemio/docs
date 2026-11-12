{%- comment -%}
Generated at build time from the signed versions manifest (site.data.manifest,
written by scripts/versions_manifest.py). Never write versions here by hand.
{%- endcomment -%}
{%- assign m = site.data.manifest -%}
Current releases, as of the platform release {{ m.platform.version }} ({{ m.platform.published_at | slice: 0, 10 }}):

| Component | Newest release | Works with platform | Platform {{ m.platform.version }} accepts |
|---|---|---|---|
| Platform (`openctemio/openctem`) | [{{ m.platform.version }}]({{ m.platform.notes_url }}) | | |
{% for c in m.components -%}
| {{ c.component }} (`{{ c.repository }}`) | [{{ c.version }}]({{ c.notes_url }}) | {% if c.requires_platform and c.requires_platform != "" %}{{ c.requires_platform }} or later{% else %}any supported release{% endif %} | {% if m.platform.accepts[c.component] %}{{ m.platform.accepts[c.component] }} or later{% else %}any release{% endif %} |
{% endfor -%}
| Helm chart `{{ m.chart.name }}` | {{ m.chart.version }} (installs {{ m.chart.app_version }}) | | |

{% assign reqs = "" -%}
{% for c in m.components -%}{% for r in c.requirements -%}
- {{ c.component }} {{ r.from }} and later need platform {{ r.platform }} or later: {{ r.reason }}.
{% endfor %}{% endfor %}
