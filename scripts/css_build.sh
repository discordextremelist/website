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


echo "Would you like to build [1] Standard CSS, [2] Form CSS, [3] Search CSS, or [A] All CSS Files?"
read input
if [ $input = 1 ]
then 
    node-sass --omit-source-map-url src/Assets/Sass/main.scss src/Assets/Public/css/standard.css --output-style compressed 
elif [ $input = 2 ]
then
    node-sass --omit-source-map-url src/Assets/Sass/form.scss src/Assets/Public/css/form.css --output-style compressed
elif [ $input = 3 ]
then
    node-sass --omit-source-map-url src/Assets/Sass/search.scss src/Assets/Public/css/search.css --output-style compressed
else
    node-sass --omit-source-map-url src/Assets/Sass/main.scss src/Assets/Public/css/standard.css --output-style compressed 
    node-sass --omit-source-map-url src/Assets/Sass/form.scss src/Assets/Public/css/form.css --output-style compressed
    node-sass --omit-source-map-url src/Assets/Sass/search.scss src/Assets/Public/css/search.css --output-style compressed
    node-sass --omit-source-map-url src/Assets/Sass/all.scss src/Assets/Public/css/all.css --output-style compressed
fi
