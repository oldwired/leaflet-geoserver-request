# Documentation leaflet-geoserver-request
[![DOI](https://zenodo.org/badge/268555102.svg)](https://zenodo.org/badge/latestdoi/268555102)
[![Build Status](https://travis-ci.org/iamtekson/leaflet-geoserver-request.svg?branch=master)](https://travis-ci.org/iamtekson/leaflet-geoserver-request)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/iamtekson/L.Geoserver)
![GitHub file size in bytes](https://img.shields.io/github/size/iamtekson/L.Geoserver/src/L.Geoserver.js)
![npm](https://img.shields.io/npm/dt/leaflet-geoserver-request)


This is the plugin for Geoserver various kind of requests. Using this plugin, we can make WMS, WFS, getLegendGraphic, WMS-Image request. 

[<h3>demo</h3>](https://iamtekson.github.io/leaflet-geoserver-request/examples/maps.html)

### Video tutorial

[![Youtube Video](https://markdown-videos.vercel.app/youtube/fdUpaWd6I_Y)](https://youtu.be/fdUpaWd6I_Y)

### Installation and setup

- **using NPM**:

```js
npm install leaflet-geoserver-request
```

- **Quick use** :

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
<script src="[path to js]/L.Geoserver.js"></script>
```

### Web-Map-Service (WMS) Request

WMS request will provides georeferenced map image.

```js
var wmsLayer = L.Geoserver.wms("http://localhost:8080/geoserver/wms", {
  layers: "topp:tasmania_roads",
});
wmsLayer.addTo(map);
```

##### WMS options

| Option      | Type     | Default   | Description                                                                                                                                     |
| ----------- | -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| layers      | string   | undefined | This is required filed. If you have multiple layers, you can add them in a comma seperated values: "workspace:layer1,workspace:layer2"          |
| format      | string   | image/png | formate of the wms request. It may be image/jpeg, image/tiff, application/openlayers                                                            |
| transparent | boolean  | true      | transparent of the map                                                                                                                          |
| CQL_FILTER  | string   | INCLUDE   | To filter the layer based on their attribute. [read more about this](https://docs.geoserver.org/latest/en/user/tutorials/cql/cql_tutorial.html) |
| zIndex      | integer  | 1000      | zIndex of the layer                                                                                                                             |
| attribution | string   | layer     | attribution of the layer. It will be added at the bottom-left cornor of the map                                                                 |
| style       | string   | undefined | style file associated with that layer. If you didn't provide the style field, it will take default style of the layer                           |
| onError     | function | null      | Function to be called when an error occurs. The error object is passed as an argument to this function                                           |
| maxZoom     | integer  | 18        | Maximum zoom level for the layer                                                                                                                |
| minZoom     | integer  | 0         | Minimum zoom level for the layer                                                                                                                |

### Web-Feature-Service (WFS) Request

In WFS request, you need to enable the `jsonp` for GeoServer. By default, `jsonp` for GeoServer was desabled. open `$GEOSERVER_HOME\webapps\geoserver\WEB-INF\web.xml` file and uncomment following line,

```xml
<context-param>
    <param-name>ENABLE_JSONP</param-name>
    <param-value>true</param-value>
</context-param>
```

**Note:** WFS request only applicable for vector layer, not for raster

```js
var wfsLayer = L.Geoserver.wfs("http://localhost:8080/geoserver/wfs", {
  layers: "topp:tasmania_roads",
});
wfsLayer.addTo(map);
```

##### WFS options

| Options       | Type               | Default   | Description                                                                                                                                     |
| ------------- | ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| layers        | string             | undefined | This is required filed. If you have multiple layers, you can add them in a comma seperated values: "workspace:layer1,workspace:layer2"          |
| style         | js object/function | null      | The style file can be in form of javascript oject or function. eg `style = {color: "black",fillOpacity: "0", opacity: "0.5" }                   |
| onEachFeature | function           | null      | Common region to add this feature is to add popup when the layer cicked. [more detail](https://leafletjs.com/examples/geojson/)                 |
| CQL_FILTER    | string             | INCLUDE   | To filter the layer based on their attribute. [read more about this](https://docs.geoserver.org/latest/en/user/tutorials/cql/cql_tutorial.html) |
| fitLayer      | boolean            | true      | The map automatically zoomed into the loaded data region                                                                                        |
| maxZoom       | integer            | 18        | Maximum zoom level that will be used when auto-zooming to features                                                                              |
| minZoom       | integer            | 0         | Minimum zoom level that will be used when auto-zooming to features                                                                              |
| onError       | function           | null      | Function to be called when an error occurs. The error object is passed as an argument to this function                                           |

### Layer Redraw Functions

Both WFS and WMS layers support redraw functionality, which allows you to refresh the layers when data has changed or when you need to update the display.

#### WFS Layer Redraw

```js
// Basic redraw
wfsLayer.redraw();

// Redraw with options
wfsLayer.redraw({
  fitLayer: false  // Don't auto-fit the map to layer bounds
});
```

The WFS redraw function:
- Clears all existing features from the layer
- Makes a new WFS request to fetch the latest data from GeoServer
- Re-adds all features to the map with current styling
- Includes debouncing to prevent too frequent server requests
- Will re-fit the map to the layer bounds if `fitLayer` option is true (default)
- Respects `maxZoom` and `minZoom` options when fitting bounds

#### WMS Layer Redraw

```js
// Basic redraw
wmsLayer.redraw();

// Redraw with options
wmsLayer.redraw({
  fitLayer: false  // Options parameter works the same as for WFS
});
```

The WMS redraw function:
- Updates the WMS request with a timestamp parameter to bypass browser caching
- Forces the WMS tiles to be refreshed with the latest data from GeoServer
- Doesn't require clearing and re-adding the layer

#### Performance Considerations

The redraw functions include several performance optimizations:

- **Debouncing**: Rapid consecutive calls to redraw are debounced to prevent overwhelming the server with requests. If you call redraw multiple times in quick succession, only the last call will execute after a short delay.

- **Automatic Throttling**: The plugin automatically adjusts the debounce delay if redraw is called too frequently, helping prevent performance issues.

- **Request Cancellation**: When redrawing WFS layers, any in-progress fetch requests are cancelled before starting a new one, preventing race conditions and reducing server load.

- **Batched Processing**: Large WFS datasets are processed in batches to maintain UI responsiveness.

```js
// Example of triggering redraw on a button click
document.getElementById('refresh-button').addEventListener('click', function() {
  wfsLayer.redraw();
});

// Example of redrawing on a timer
setInterval(function() {
  wmsLayer.redraw();
}, 30000); // Refresh every 30 seconds
```

### Web-Mapping-Service-Image (WMSImage) request

This is the custom request naming by me. It will generate the image which will zoomed to the desired location. The main different between `wms` and `wmsImage` request is, it can be zoomed to the desired location based on vector layer.

There are certain convention for this request. Please read carefully

- The first layer must be vector layer in option `wmsLayers`. Rest of other layers can be vector or raster

- You need to provide the same number of data list in `wmsLayers`, `wmsCQL_FILTER` & `wmsStyle` fields

- The map will zoomed to the first parameter of `wmsCQL_FILTER` region

- The default value for the style and cql_filter will be include

- The wmsLayers and wmsId fields are required field

```html
<img src="" id="wmsImage" />
<!-- The id field is required. This id will used in js script option "wmsId"-->
```

```js
L.Geoserver.wmsImage("http://localhost:8080/geoserver/wms", {
  wmsLayers: [
    "workspace:first_layer",
    "workspace:second_layer",
    "workspace:third_layer",
  ],
  wmsCQL_FILTER: ["district=='Syangja'", "INCLUDE", "INCLUDE"],
  wmsStyle: ["style1", "style2", "INCLUDE"],
  format: "image/png",
  wmsId: "wmsImage",
  width: 300,
  height: 300,
  onError: function(error) {
    console.error("WMS Image error:", error);
  }
});
```

### Legend Request

The legend request will provide the crossponding legend of the layer to the bottom-left position of the map. In case of not providing style parameter, it will take the default style from GeoServer.

```js
var layerLegend = L.Geoserver.legend("http://localhost:8080/geoserver/wms", {
  layers: "topp:tasmania_roads",
  style: `stylefile`,
});

layerLegend.addTo(map);
```

### Error Handling

All request types (WMS, WFS, WMSImage) support error handling through the `onError` option. This allows you to provide a custom function to handle errors that occur during requests.

```js
// Example of error handling with WFS
var wfsLayer = L.Geoserver.wfs("http://localhost:8080/geoserver/wfs", {
  layers: "topp:tasmania_roads",
  onError: function(error) {
    console.error("Custom error handler:", error);
    // Show user notification, log to server, etc.
  }
});

// The default error handler logs to console
// onError: function(error) {
//   console.error("GeoServer request error:", error);
// }
```

The error handling includes:
- Network errors during requests
- Invalid responses from GeoServer
- JSONP request timeouts (for WFS)
- Request cancellation during rapid redraws

### Advance WFS request demo

```js
var wfsLayerAdvance = L.Geoserver.wfs("http://localhost:8080/geoserver/wms", {
  layers: "topp:tasmania_roads",
  style: {
    color: "black",
    fillOpacity: "0",
    opacity: "0.5",
  },
  onEachFeature: function (feature, layer) {
    layer.bindPopup("this is popuped");
  },
  CQL_FILTER: "district='Syangja'",
});

map.fitBounds(wfsLayerAdvance.getBounds());
wfsLayerAdvance.addTo(map);
```
### Contribution:

Would :heart: to see any contributions.

### Appreciate:
If you liked my work, show some :heart: by :star: repo.

Also you can appreciate by

<p>
 <table style="border-spacing: 5px 10px;">

 <tr>
  <td>
<a href="https://www.buymeacoffee.com/iamtekson"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" style="max-width:90%;" width="200" height="60"></a>
</td>

  <td style="margin: 10px">
<a href="https://paypal.me/tekcalgary"><img src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-200px.png" alt="PayPal Logo"
style="max-width:90%;" width="200" height="60">
 </td>
 </tr>
 </table>
</p> 
