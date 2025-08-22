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


// Will Directly Save To Users Drive

//Export.image.toDrive({
//  image: lulc.toInt(),
//  description: 'LULC_CART_S2_10m',
//  region: study_area.geometry(),
//  scale: 10,
//  maxPixels: 1e13
//});
