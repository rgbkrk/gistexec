/**
 * @class Gistie
 * @classdesc pulls notebooks from GitHub gists and propagates cells on the page
 * @param {number} gistID Gist numeric id
 */
Gistie = function(gistID) {
  // Don't need oauthentication if only using gists
  this.gh = new Github({});

  // gist API
  this.gistAPI = this.gh.getGist(gistID);

  // Read the gist itself
  this.gistAPI.read(this._read.bind(this));
};

/**
 * Implements the callback for a Github.gist.read
 * @param error
 * @param {Object} Github gist
 */
Gistie.prototype._read = function(err, gist) {
  this.gist = gist;
  this.files = gist.files;

  for (var filename in gist.files) {
    if (gist.files.hasOwnProperty(filename)) {
      var file = gist.files[filename];
      // TODO: Check that it's really a notebook (extension, existence of content key)
      // TODO: Check for file.truncated
      this.nb = JSON.parse(file.content);

      // TODO: Declare this a notebook read event
      this.renderNotebook(this.nb);
    }
  }
};

/**
 * Render a notebook on the DOM. Likely ugly.
 * @param {Object} notebook Jupyter Notebook document
 */
Gistie.prototype.renderNotebook = function(notebook) {
  var $container = $('#container');
  for (cellID = 0; cellID < this.nb.cells.length; cellID++ ) {
    var cell = this.nb.cells[cellID];
    $container.append('<pre>' + cell.source + '</pre>');
  }
};

gistexec = function( ) {
  var params = getUrlParams();

  return new Gistie(params.gistID || 'cb6da4c0f285713fb4b5');
};

/**
 * Returns a bare object of the URL's query parameters.
 * You can pass just a query string rather than a complete URL.
 * The default URL is the current page.
 *
 * From: http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
 */
var getUrlParams = function(url) {
    // http://stackoverflow.com/a/23946023/2407309
    if (typeof url == 'undefined') {
        url = window.location.search;
    }
    url = url.split('#')[0]; // Discard fragment identifier.
    var queryString = url.split('?')[1];
    if (!queryString) {
        if (url.search('=') !== false) {
            queryString = url;
        }
    }
    var urlParams = {};
    if (queryString) {
        var keyValuePairs = queryString.split('&');
        for (var i = 0; i < keyValuePairs.length; i++) {
            var keyValuePair = keyValuePairs[i].split('=');
            var paramName = keyValuePair[0];
            var paramValue = keyValuePair[1] || '';
            urlParams[paramName] = decodeURIComponent(paramValue.replace(/\+/g, ' '));
        }
    }
    return urlParams;
}; // getUrlParams
