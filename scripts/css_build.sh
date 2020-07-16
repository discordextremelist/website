#!/bin/bash/

# Discord Extreme List - Discord's unbiased list.

# Copyright (C) 2020 Cairo Mitchell-Acason, John Burke, Advaith Jagathesan

# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.

# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

echo "Would you like to build [1] Standard CSS, [2] Form CSS, [3] Search CSS, [4], Listing CSS or [A] All CSS Files?"
read input
if [ $input = 1 ]; then
    node-sass --omit-source-map-url assets/Sass/black/main.scss assets/Public/css/theme/black/standard.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/dark/main.scss assets/Public/css/theme/dark/standard.css --output-style compressed
elif [ $input = 2 ]; then
    node-sass --omit-source-map-url assets/Sass/black/form.scss assets/Public/css/theme/black/form.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/dark/form.scss assets/Public/css/theme/dark/form.css --output-style compressed
elif [ $input = 3 ]; then
    node-sass --omit-source-map-url assets/Sass/black/search.scss assets/Public/css/theme/black/search.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/dark/search.scss assets/Public/css/theme/dark/search.css --output-style compressed
elif [ $input = 4 ]; then
    node-sass --omit-source-map-url assets/Sass/black/listing.scss assets/Public/css/theme/black/listing.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/dark/listing.scss assets/Public/css/theme/dark/listing.css --output-style compressed
else
    node-sass --omit-source-map-url assets/Sass/black/main.scss assets/Public/css/theme/black/standard.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/black/form.scss assets/Public/css/theme/black/form.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/black/search.scss assets/Public/css/theme/black/search.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/black/listing.scss assets/Public/css/theme/black/listing.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/black/all.scss assets/Public/css/theme/black/all.css --output-style compressed

    node-sass --omit-source-map-url assets/Sass/dark/main.scss assets/Public/css/theme/dark/standard.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/dark/form.scss assets/Public/css/theme/dark/form.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/dark/search.scss assets/Public/css/theme/dark/search.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/dark/listing.scss assets/Public/css/theme/dark/listing.css --output-style compressed
    node-sass --omit-source-map-url assets/Sass/dark/all.scss assets/Public/css/theme/dark/all.css --output-style compressed
fi
