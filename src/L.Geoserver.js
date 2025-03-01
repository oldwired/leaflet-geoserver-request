L.Geoserver = L.FeatureGroup.extend({
  //Some of the default options
  options: {
    layers: "",
    format: "image/png",
    transparent: true,
    CQL_FILTER: "INCLUDE",
    zIndex: 1000,
    version: "",
    srsname: "EPSG:4326",
    attribution: `layer`,
    fitLayer: true,
    style: "",
    onEachFeature: function (feature, layer) {},
    wmsLayers: [],
    wmsCQL_FILTER: [],
    wmsStyle: [],
    width: 500,
    height: 500,
    onError: function(error) {
      console.error("GeoServer request error:", error);
    }
  },

  // debounce function
  _debounce: function(func, wait) {
    let timeout;
    return (...args) => {
      const context = this;
      const later = () => {
        clearTimeout(timeout);
        func.apply(context, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // constructor function
  initialize: function (baseLayerUrl, options) {
    this.baseLayerUrl = baseLayerUrl;

    L.setOptions(this, options);

    this._layers = {};

    this.state = {
      exist: "exist",
    };
    this._lastRedraw = 0;
    this._minRedrawInterval = 500; // ms
    this._debouncedFetchAndAddLayers = this._debounce(this._fetchAndAddLayers, 250);
  },

  redraw: function() {
    const now = Date.now();
    
    // If redraw is called too frequently, adjust the debounce delay
    if (now - this._lastRedraw < this._minRedrawInterval) {
      this._debouncedFetchAndAddLayers = this._debounce(
        this._fetchAndAddLayers, 
        this._minRedrawInterval
      );
    } else {
      this._debouncedFetchAndAddLayers = this._debounce(
        this._fetchAndAddLayers, 
        250
      );
    }
    
    this._lastRedraw = now;
    this.clearLayers();
    this._debouncedFetchAndAddLayers();
    return this;
  },

  //wms layer function
  wms: function () {

    if (!this.options.version) {
      this.options.version = '1.1.1';
    }

    return L.tileLayer.wms(this.baseLayerUrl, this.options);
  },

  _getUniqueCallbackId: function() {
    return 'getJson_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
  },

  _fetchAndAddLayers: function() {
    var that = this;
    
    // Cancel previous request if exists
    if (this._abortController) {
      this._abortController.abort();
    }
    
    // Create new abort controller
    this._abortController = new AbortController();
    
    var callbackName = this._getUniqueCallbackId();
    
    // Build the URL with query parameters
    const url = new URL(this.baseLayerUrl);
    const params = {
      service: "WFS",
      version: this.options.version || '1.1.0',
      request: "GetFeature",
      typename: this.options.layers,
      CQL_FILTER: this.options.CQL_FILTER,
      srsname: this.options.srsname,
      outputFormat: "application/json"
    };
    
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    // Add signal to fetch options
    fetch(url, { signal: this._abortController.signal })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        that._addLayers(data);
        that.fire('loaded'); // Emit loaded event
      })
      .catch(error => {
        // AbortError is expected when we cancel a request
        if (error.name !== 'AbortError') {
          that.fire('error', { error: error });
          if (that.options.onError) {
            that.options.onError(error);
          }
        }
      });
  },

  _addLayers: function(data) {
    var that = this;
    
    // Process features in batches for large datasets
    const BATCH_SIZE = 100;
    const features = data.features;
    
    const processBatch = function(startIdx) {
      const endIdx = Math.min(startIdx + BATCH_SIZE, features.length);
      
      for (let i = startIdx; i < endIdx; i++) {
        // Process each feature as before
        var layer = L.GeoJSON.geometryToLayer(
          features[i],
          that.options || null
        );
        
        layer.feature = features[i];
        layer.options.onEachFeature = that.options.onEachFeature(
            layer.feature,
            layer
        );
        
        that.addLayer(layer);
        if (typeof that.options.style === "function" && layer.setStyle) {
          layer.setStyle(that.options.style(layer.feature));
        } else if (that.options.style && layer.setStyle) {
          layer.setStyle(that.options.style);
        }
      }
      
      // If more features to process, schedule next batch
      if (endIdx < features.length) {
        setTimeout(function() {
          processBatch(endIdx);
        }, 0);
      } else if (that.options.fitLayer && that._map) {
        that._map.fitBounds(that.getBounds());
        that.fire('loaded');
      }
    };
    
    // Start processing first batch
    processBatch(0);
  },

  //wfs layer fetching function
  //Note this function will work only for vector layer

  wfs: function() {
    var that = this;

    if (!that.options.version) {
      that.options.version = '1.1.0';
    }

    that._fetchAndAddLayers();

    return that;
  },

  //Legend of the map
  legend: function () {
    var that = this;
    var legend = L.control({ position: "bottomleft" });
    legend.onAdd = function (map) {
      var div = L.DomUtil.create("div", "info Legend");
      var url = `${that.baseLayerUrl}/wms?REQUEST=GetLegendGraphic&VERSION=${that.options.version}&FORMAT=image/png&LAYER=${that.options.layers}&style=${that.options.style}`;
      div.innerHTML +=
          "<img src=" +
          url +
          ' alt="legend" data-toggle="tooltip" title="Map legend">';
      return div;
    };
    return legend;
  },

  //This function is used for zooming the raster layer using specific vector data
  wmsImage: function () {
    var that = this;
    
    // We need to handle JSONP manually since fetch doesn't support it natively
    var callbackName = this._getUniqueCallbackId();
    
    // Create script element for JSONP
    var script = document.createElement('script');
    
    // Define the callback function in the global scope
    window[callbackName] = function(data) {
      document.body.removeChild(script);
      delete window[callbackName];
      
      // bounding box for the selected vector layer
      var selectedArea = L.geoJson(data);
      var bboxX1 = selectedArea.getBounds()._southWest.lng;
      var bboxX2 = selectedArea.getBounds()._northEast.lng;
      var bboxY1 = selectedArea.getBounds()._southWest.lat;
      var bboxY2 = selectedArea.getBounds()._northEast.lat;
      var bboxList = [bboxX1, bboxX2, bboxY1, bboxY2];
      var bufferBbox = Math.min((bboxX2 - bboxX1) * 0.1, (bboxY2 - bboxY1) * 0.1);
      var maxValue = Math.max(bboxX2 - bboxX1, bboxY2 - bboxY1) / 2.0;

      var otherLayers = "";
      var otherStyle = "";
      var otherCqlFilter = "";
      for (var i = 1; i < that.options.wmsLayers.length; i++) {
        otherLayers += that.options.wmsLayers[i];
        otherStyle += that.options.wmsStyle[i];
        otherCqlFilter += that.options.wmsCQL_FILTER[i];
        if (i != that.options.wmsLayers.length - 1) {
          otherLayers += ",";
          otherStyle += ",";
          otherCqlFilter += ";";
        }
      }

      //final wmsLayerUrl
      var wmsLayerURL = `${that.baseLayerUrl}/wms?` + 
        `service=WMS&` +
        `version=1.3.0&` +
        `request=GetMap&` +
        `layers=${otherLayers}&` +
        `styles=${otherStyle}&` +
        `cql_filter=${otherCqlFilter}&` +
        `bbox=${(bboxX1 + bboxX2) * 0.5 - maxValue - bufferBbox},` +
              `${(bboxY1 + bboxY2) * 0.5 - maxValue - bufferBbox},` +
              `${(bboxX1 + bboxX2) * 0.5 + maxValue + bufferBbox},` +
              `${(bboxY1 + bboxY2) * 0.5 + maxValue + bufferBbox}&` +
        `width=${that.options.width}&` +
        `height=${that.options.height}&` +
        `srs=EPSG%3A4326&` +
        `format=image/png`;
      
      // Update the image element directly without jQuery
      document.getElementById(that.options.wmsId).setAttribute("src", wmsLayerURL);
      that.fire('wmsImageLoaded', { url: wmsLayerURL });
    };

    // Set up timeout for error handling
    var timeoutId = setTimeout(function() {
      if (window[callbackName]) {
        document.body.removeChild(script);
        delete window[callbackName];
        that.fire('error', { error: new Error('JSONP request timed out') });
        if (that.options.onError) {
          that.options.onError(new Error('JSONP request timed out'));
        }
      }
    }, 10000); // 10 second timeout
    
    // Build the URL with the callback parameter
    var url = `${that.baseLayerUrl}/ows?service=WFS&version=${that.options.version || '1.1.0'}&request=GetFeature&cql_filter=${that.options.wmsCQL_FILTER[0]}&typeName=${that.options.wmsLayers[0]}&srsName=EPSG:4326&maxFeatures=50&outputFormat=text%2Fjavascript&format_options=callback:${callbackName}`;
    
    script.type = 'text/javascript';
    script.src = url;
    script.onerror = function() {
      document.body.removeChild(script);
      delete window[callbackName];
      clearTimeout(timeoutId);
      that.fire('error', { error: new Error('Failed to load JSONP script') });
      if (that.options.onError) {
        that.options.onError(new Error('Failed to load JSONP script'));
      }
    };
    
    // Add the script to the document to start the request
    document.body.appendChild(script);
    
    return that;
  },
});

L.Geoserver.wms = function (baseLayerUrl, options) {
  var req = new L.Geoserver(baseLayerUrl, options);
  return req.wms();
};

L.Geoserver.wfs = function (baseLayerUrl, options) {
  var req = new L.Geoserver(baseLayerUrl, options);
  return req.wfs();
};

L.Geoserver.legend = function (baseLayerUrl, options) {
  var req = new L.Geoserver(baseLayerUrl, options);
  return req.legend();
};

L.Geoserver.wmsImage = function (baseLayerUrl, options) {
  var req = new L.Geoserver(baseLayerUrl, options);
  return req.wmsImage();
};
