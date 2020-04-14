#!/bin/bash/

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
