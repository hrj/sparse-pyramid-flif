// Base on https://raw.githubusercontent.com/balrog-kun/Leaflet.bpg/master/TileLayer.BPG.js
/*
 * L.TileLayer.FLIF can be used with normal (TMS) tile layers in the FLIF
 * format if the browser doesn't support that format natively.  The
 * javascript decoder is then used. PolyFLIF must be included.
 */
L.GridLayer.FLIF = L.GridLayer.extend({
  getTileUrl : function(coords) {
    var base = '/eso-flif/' + (coords.z < 5 ? 'pyramid-'+(coords.z) +'-' : 'tile-');
    return base+(coords.y+1)+'-'+(coords.x+1)+'.flif';
  },

  _loadXHR:    function (src, bytes, andThen) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.open("GET", src);
    if (bytes) {                                                                                                                                   
      xhr.setRequestHeader('Range', 'bytes=0-' + bytes);
    }
    xhr.onload = function() {
      var content = bytes ? new Uint8Array(this.response, 0, Number.parseInt(bytes)) : new Uint8Array(this.response);
      andThen(content);
    };
    xhr.send();
  },

  getTileInfo: new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "/eso-flif/tile-info2.json");
      xhr.onload = function() {
        var tileInfo = JSON.parse(this.responseText);
        resolve(tileInfo);
      };
      xhr.send();
  }),

  createTile: function (coords, done) {
    var tileSize = this.getTileSize();

    var tile = L.DomUtil.create('div', '');
    // tile.setAttribute("style", "background-color:transparent;width:"+tileSize.x+"px;height:"+tileSize.y+"px");

    var that = this;
    this.getTileInfo.then(function(tileInfo) {
      var levelTileInfo = tileInfo[coords.z-1];
      if (!levelTileInfo) {
        var subTileSize = {x: tileSize.x/2, y: tileSize.y/2};
        var doneCalled = false;
        function subDone() {
          if (!doneCalled) {
            done(undefined, tile);
            doneCalled = true;
          }
        }
        function appendSubTile(x, y) {
          var halfBytes = tileInfo[coords.z][coords.x][coords.y];
          tile.appendChild(that.createSimpleTile(halfBytes, {z:coords.z, x:x, y:y}, subDone, '', subTileSize, tileSize.x/2));
        }
        appendSubTile(coords.x*2, coords.y*2);
        appendSubTile(coords.x*2 + 1, coords.y*2);
        appendSubTile(coords.x*2, coords.y*2 + 1);
        appendSubTile(coords.x*2 + 1, coords.y*2 + 1);
  
      } else {
        tile.appendChild(that.createSimpleTile(undefined, {z:coords.z-1, x:coords.x, y:coords.y}, function(){done(undefined, tile)}, '', tileSize, 0));
      }
    });

    return tile;
  },

  isFirst : true,

  createSimpleTile: function (count, coords, done, tileClass, tileSize, renderSize) {
    var tile = L.DomUtil.create('canvas', tileClass);
    var url = this.getTileUrl(coords);
    var that = this;
    // setup tile width and height according to the options
    tile.width = tileSize.x;
    tile.height = tileSize.y;

    that._loadXHR(url, count, function(buffer) {
      var showPreviews = that.isFirst; // coords.z == 0;
      that.isFirst = false;
      var options = {
        canvas: tile,
        buf: buffer,
        onload: function() {console.log("loaded: ", url); if (!showPreviews) {done(null, tile);}}
      }
      var dec = new PolyFlif(options);
      dec.beginCount(showPreviews, -1, renderSize, renderSize);
      if (showPreviews) {
        done(null, tile);
      }
    });

    return tile;
  },

  _tileOnError: function (done, tile, e) {
    done(e, tile);
  },

  _onTileRemove: function (e) {
    // console.log("TODO on tile remove");
    if ('dec' in e.tile) {
        // currently nothing to do (?)
    }
  }

});

/*
L.TileLayer.FLIF.addInitHook(function(){
    console.log("init hook called");
});

L.tileLayer.flif = function (url, options) {
  return new L.TileLayer.FLIF(url, options);
};
*/
