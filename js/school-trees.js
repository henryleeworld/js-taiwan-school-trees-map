var sidebar = new ol.control.Sidebar({
    element: 'sidebar',
    position: 'right'
});
var jsonFiles, filesLength, fileKey = 0;

var projection = ol.proj.get('EPSG:3857');
var projectionExtent = projection.getExtent();
var size = ol.extent.getWidth(projectionExtent) / 256;
var resolutions = new Array(20);
var matrixIds = new Array(20);
for (var z = 0; z < 20; ++z) {
    resolutions[z] = size / Math.pow(2, z);
    matrixIds[z] = z;
}

var sidebarTitle = document.getElementById('sidebarTitle');
var content = document.getElementById('sidebarContent');

var appView = new ol.View({
    center: ol.proj.fromLonLat([121.564101, 25.033493]),
    zoom: 14
});

var vectorPoints = new ol.layer.Vector({
    source: new ol.source.Vector({
        format: new ol.format.GeoJSON({
            featureProjection: appView.getProjection()
        }),
        url: 'data/school.json'
    }),
    style: pointStyleFunction
});

var vectorTree = new ol.layer.Vector({
    source: new ol.source.Vector({
        format: new ol.format.GeoJSON({
            featureProjection: appView.getProjection()
        })
    }),
    style: new ol.style.Style({
        image: new ol.style.RegularShape({
            radius: 5,
            radius2: 3,
            points: 5,
            fill: new ol.style.Fill({
                color: '#ff0000'
            })
        })
    })
});

var baseLayer = new ol.layer.Tile({
    source: new ol.source.WMTS({
        matrixSet: 'EPSG:3857',
        format: 'image/png',
        url: 'https://wmts.nlsc.gov.tw/wmts',
        layer: 'EMAP',
        tileGrid: new ol.tilegrid.WMTS({
            origin: ol.extent.getTopLeft(projectionExtent),
            resolutions: resolutions,
            matrixIds: matrixIds
        }),
        style: 'default',
        wrapX: true,
        attributions: '<a href="http://maps.nlsc.gov.tw/" target="_blank">國土測繪圖資服務雲</a>'
    }),
    opacity: 0.8
});

var map = new ol.Map({
    layers: [baseLayer, vectorPoints, vectorTree],
    target: 'map',
    view: appView
});

map.addControl(sidebar);
var pointClicked = false;
map.on('singleclick', function(evt) {
    content.innerHTML = '';
    pointClicked = false;
    map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
        if (false === pointClicked) {
            var p = feature.getProperties();
            var targetHash = '#' + p.code;
            if (window.location.hash !== targetHash) {
                window.location.hash = targetHash;
            }
            pointClicked = true;
        }
    });
});

function pointStyleFunction(f) {
    var p = f.getProperties(),
        color, stroke, radius;
    if (f === currentFeature) {
        stroke = new ol.style.Stroke({
            color: '#000',
            width: 5
        });
        radius = 25;
    } else {
        stroke = new ol.style.Stroke({
            color: '#fff',
            width: 2
        });
        radius = 15;
    }
    color = '#48c774';
    return new ol.style.Style({
        image: new ol.style.RegularShape({
            radius: radius,
            points: 5,
            fill: new ol.style.Fill({
                color: color
            }),
            stroke: stroke
        })
    })
}

var previousFeature = false;
var currentFeature = false;
var currentSchool = {};

function showPoint(pointId) {
    firstPosDone = true;

    $.getJSON('data/school/' + pointId + '.json', function(c) {
        currentSchool = c;
        var features = vectorPoints.getSource().getFeatures();
        var pointFound = false;
        for (k in features) {
            var p = features[k].getProperties();
            if (p.code === pointId) {
                currentFeature = features[k];
                features[k].setStyle(pointStyleFunction(features[k]));
                if (false !== previousFeature) {
                    previousFeature.setStyle(pointStyleFunction(previousFeature));
                }
                previousFeature = currentFeature;
                appView.setCenter(features[k].getGeometry().getCoordinates());
                appView.setZoom(15);
                var lonLat = ol.proj.toLonLat(p.geometry.getCoordinates());

                var message = '<table class="table table-dark">';
                message += '<tbody>';
                for (j in c.info) {
                    message += '<tr><th scope="row">' + j + '</th><td>' + c.info[j] + '</td></tr>';
                }
                message += '<tr><td colspan="2">';
                for (j in c.tree) {
                    message += '<a class="btn btn-info btn-tree" href="#" data-tree-index="' + j + '">' + j + '(' + c.tree[j].length + ')</a>';
                }
                message += '</td></tr>';
                message += '<tr><td colspan="2">';
                message += '<hr /><div class="btn-group-vertical" role="group" style="width: 100%;">';
                message += '<a href="https://www.google.com/maps/dir/?api=1&destination=' + lonLat[1] + ',' + lonLat[0] + '&travelmode=driving" target="_blank" class="btn btn-info btn-lg btn-block">Google 導航</a>';
                message += '<a href="https://wego.here.com/directions/drive/mylocation/' + lonLat[1] + ',' + lonLat[0] + '" target="_blank" class="btn btn-info btn-lg btn-block">Here WeGo 導航</a>';
                message += '<a href="https://bing.com/maps/default.aspx?rtp=~pos.' + lonLat[1] + '_' + lonLat[0] + '" target="_blank" class="btn btn-info btn-lg btn-block">Bing 導航</a>';
                message += '</div></td></tr>';
                message += '</tbody></table>';
                $('#sidebarTitle').html(pointId);

                content.innerHTML = message;
                $('a.btn-tree', content).click(function(e) {
                    e.preventDefault();
                    currentFeature.setStyle(new ol.style.Style());
                    var treeFeatures = [];
                    var selectedTree = $(this).attr('data-tree-index');
                    for (i in currentSchool.tree[selectedTree]) {
                        treeFeatures.push(new ol.Feature({
                            geometry: new ol.geom.Point(ol.proj.fromLonLat(currentSchool.tree[selectedTree][i]))
                        }));
                    }
                    vectorTree.getSource().clear();
                    vectorTree.getSource().addFeatures(treeFeatures);
                    sidebar.close();
                });
            }
        }
    });



    sidebar.open('home');
}

var geolocation = new ol.Geolocation({
    projection: appView.getProjection()
});

geolocation.setTracking(true);

geolocation.on('error', function(error) {
    console.log(error.message);
});

var positionFeature = new ol.Feature();

positionFeature.setStyle(new ol.style.Style({
    image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({
            color: '#3399CC'
        }),
        stroke: new ol.style.Stroke({
            color: '#fff',
            width: 2
        })
    })
}));

var firstPosDone = false;
geolocation.on('change:position', function() {
    var coordinates = geolocation.getPosition();
    positionFeature.setGeometry(coordinates ? new ol.geom.Point(coordinates) : null);
    if (false === firstPosDone) {
        appView.setCenter(coordinates);
        firstPosDone = true;
    }
});

new ol.layer.Vector({
    map: map,
    source: new ol.source.Vector({
        features: [positionFeature]
    })
});

$('#btn-geolocation').click(function() {
    var coordinates = geolocation.getPosition();
    if (coordinates) {
        appView.setCenter(coordinates);
    } else {
        alert('目前使用的設備無法提供地理資訊');
    }
    return false;
});

var findTerms = [];
$.getJSON('data/tree.json', {}, function(items) {
    for (k in items) {
        findTerms.push({
            value: k,
            label: k + ' ' + items[k]
        });
    }

    routie(':pointId', showPoint);

    $('#findTree').autocomplete({
        source: findTerms,
        select: function(event, ui) {
            vectorPoints.setSource(new ol.source.Vector({
                format: new ol.format.GeoJSON({
                    featureProjection: appView.getProjection()
                }),
                url: 'data/tree/' + ui.item.value + '.json'
            }));
            sidebar.close();
        }
    });
});