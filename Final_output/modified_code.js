var QA_training = training
      .map(function(f){
    return ee.Feature(f.geometry(), {
      Class: ee.Number(f.get('Class')).int(),
      group: f.get('group')                    
    });
  });

//SFCC_composite
var SFCC = sentinel2
  .filterBounds(study_area)
  .filterDate('2025-01-01','2025-03-31')
  .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median()
  .clip(study_area)
  .select(['B8','B4','B3']);

// defining samples on each pixels
var samples = SFCC.sampleRegions({
  collection: QA_training,
  properties: ['Class'],
  scale: 10,
  tileScale: 2
});

// Train SMILECart
var bands = ['B8','B4','B3'];
var clf = ee.Classifier.smileCart().train({
  features: samples,
  classProperty: 'Class',
  inputProperties: bands
});

// Classify
var lulc = SFCC.classify(clf);
//Creating Legend layout and Colors 
var classDict = {
  1: {name: 'Waterbody',         color: '#0fa1db'},
  2: {name: 'Urban',             color: '#ff0000'},
  3: {name: 'Crop Land',         color: '#f9ff00'},
  4: {name: 'Sandy Area',        color: '#edd798'},
  5: {name: 'Fallow Land',       color: '#d6ff06'},
  6: {name: 'Evergreen Forest',  color: '#52ac48'},
  7: {name: 'Deciduous Forest',  color: '#2ace18'},
  8: {name: 'Plantation',        color: '#2ee592'}
};
var legend = ui.Panel({
  style: {position: 'bottom-left',padding: '8px 15px',backgroundColor: 'white'}});

legend.add(ui.Label({
  value: 'LULC Legend',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 6px 0',
    color: 'black'
  }
}));

//Adding Legend to the map
Object.keys(classDict).forEach(function(key) {
var entry = classDict[key];
var colorBox = ui.Label({style: {backgroundColor: entry.color,padding: '8px', margin: '0 0 4px 0'}});
var label = ui.Label({value: key + ' - ' + entry.name,style: {margin: '0 0 4px 6px'}});
legend.add(ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal')));});

Map.add(legend);

Map.centerObject(study_area, 9);
Map.addLayer(lulc, vis, 'East Godavai LULC');


//Generating bar diagram with each bar according class color codes

var classDict = {
  1: {name: 'Waterbody',        color: '#0fa1db'},
  2: {name: 'Urban',            color: '#ff0000'},
  3: {name: 'Crop Land',        color: '#f9ff00'},
  4: {name: 'Sandy Area',       color: '#edd798'},
  5: {name: 'Fallow Land',      color: '#d6ff06'},
  6: {name: 'Evergreen Forest', color: '#52ac48'},
  7: {name: 'Deciduous Forest', color: '#2ace18'},
  8: {name: 'Plantation',       color: '#2ee592'}
};

var classes = [1,2,3,4,5,6,7,8];
var labels  = classes.map(function(c){ return classDict[c].name; });
var colors  = classes.map(function(c){ return classDict[c].color; });

// for calculating and visualising area per square km in bars
var areaImage = ee.Image.pixelArea().divide(1e6).rename('area_km2');
var grouped = areaImage.addBands(lulc.rename('class'))
  .reduceRegion({reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),geometry: study_area,scale: 60,maxPixels: 1e13,tileScale: 2});
var groupsList = ee.List(ee.Dictionary(grouped).get('groups'));
var fcRaw = ee.FeatureCollection(groupsList.map(function(item) {item = ee.Dictionary(item);return ee.Feature(null, {'class': item.get('class'), 'area_km2': item.get('sum')});
}));

var areas = ee.List(classes).map(function(c){var match = fcRaw.filter(ee.Filter.eq('class', c)).first();return ee.Algorithms.If(match, ee.Number(ee.Feature(match).get('area_km2')), 0);
});

// creating diagonal matrix so each bar can have own color
var n = classes.length;
var idx = ee.List.sequence(0, n - 1);
var rows = idx.map(function(i){i = ee.Number(i);
  var ai = ee.Number(areas.get(i));  
  var row = idx.map(function(j){j = ee.Number(j);return ee.Algorithms.If(i.eq(j), ai, 0);});return row;});
var mat = ee.Array(rows); 

// Building chart
var chart = ui.Chart.array.values(mat, 0, labels).setSeriesNames(labels).setChartType('ColumnChart').setOptions({title: 'Area by LULC class (km²)',legend: 'none',hAxis: { title: 'Class' },vAxis: { title: 'Area (km²)' },colors: colors,bar: { groupWidth: '90%' },chartArea: {left: 80, top: 40, width: '75%', height: '65%'}});

print(chart);



// creating structure to download csv
var legendNames = ee.Dictionary({
  '1': 'Waterbody',
  '2': 'Urban',
  '3': 'Crop Land',
  '4': 'Sandy Area',
  '5': 'Fallow Land',
  '6': 'Evergreen Forest',
  '7': 'Deciduous Forest',
  '8': 'Plantation'
});
var areaImage = ee.Image.pixelArea().divide(1e6).rename('area_km2');
var grouped = areaImage.addBands(lulc.rename('class')).reduceRegion({reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),geometry: study_area,scale: 60,maxPixels: 1e13,tileScale: 2});

var groupsList = ee.List(ee.Dictionary(grouped).get('groups'));
var tableFC = ee.FeatureCollection(groupsList.map(function(item) {item = ee.Dictionary(item);return ee.Feature(null, {'class': item.get('class'),'area_km2': item.get('sum')});}));

var totalArea = ee.Number(tableFC.aggregate_sum('area_km2'));
var exportFC = tableFC.map(function(f){
  var c = ee.Number(f.get('class'));
  var label = ee.String(legendNames.get(c.format()));
  var area  = ee.Number(f.get('area_km2'));
  var pct   = ee.Algorithms.If(totalArea.gt(0),area.divide(totalArea).multiply(100), 0);return f.set({'label': label,'pct': ee.Number(pct)});});



// Will Directly Save the LULC To Users Drive

//Export.image.toDrive({
//  image: lulc.toInt(),
//  description: 'LULC_CART_S2_10m',
//  region: study_area.geometry(),
//  scale: 10,
//  maxPixels: 1e13
//});
//

// Export to Drive as CSV
//Export.table.toDrive({
//  collection: exportFC,
//  description: 'LULC_area_by_class_km2',
//  fileNamePrefix: 'LULC_area_by_class_km2',
//  fileFormat: 'CSV',
//  selectors: ['class','label','area_km2','pct']  // column order
//});
