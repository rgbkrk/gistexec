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
 * String.includes polyfill
 */
if (!String.prototype.includes) {
  String.prototype.includes = function() {'use strict';
    return String.prototype.indexOf.apply(this, arguments) !== -1;
  };
}

/**
 * Implements the callback for a Github.gist.read, intended to be bound to
 * `this`, which is bound in the constructor (this._read.bind(this)) call to read
 * @param error
 * @param {Object} Github gist
 */
Gistie.prototype._read = function(err, gist) {
  this.gist = gist;
  this.files = gist.files;

  for (var filename in gist.files) {
    // TODO: Check that it's really a notebook (extension, existence of content key)
    if (gist.files.hasOwnProperty(filename) && filename.includes('.ipynb')) {
      var file = gist.files[filename];
      if (file.truncated) {
        console.log("File truncated, fetching raw URL");
        $.getJSON(file.raw_url, this.renderNotebook.bind(this));
      } else {
        console.log("Notebook small enough to render straight from gist API");
        notebook = JSON.parse(file.content);
        this.renderNotebook(notebook);
      }
    }
  }
};

/**
 * Render a notebook on the DOM. Likely ugly.
 * @param {Object} notebook Jupyter Notebook document
 */
Gistie.prototype.renderNotebook = function(notebook) {
  console.log("Rendering notebook");
  var $container = $('#container');
  console.log(notebook);

  if (notebook.hasOwnProperty('worksheets')) {
    // Slight conversion from < v4 notebook to v4
    notebook.cells = notebook.worksheets[0].cells;
    for (cellID = 0; cellID < notebook.cells.length; cellID++ ) {
      var cell = notebook.cells[cellID];
      cell.source = cell.input;
    }
  }

  for (cellID = 0; cellID < notebook.cells.length; cellID++ ) {
    var cell = notebook.cells[cellID];
    if (cell.source && cell.cell_type) {
      if (cell.cell_type == 'code') {
        var code;

        if (typeof cell.source === 'string') {
          code = cell.source;
        } else { // Assume list of source cells
          code = cell.source.join('');
        }

        // Raw <pre> cells with source for thebe to process
        $container.append('<pre data-executable=\'true\'>' + code + '</pre>\n');
      } else if (cell.cell_type == 'markdown') {
        var markdown;

        if (typeof cell.source === 'string') {
          markdown = cell.source;
        } else { // Assume list of source cells
          markdown = cell.source.join('');
        }

        // Little blocks of markdown everywhere
        var html = marked(markdown);
        var el = $container.append('<div class="md">' + html + '</div>');

        // Render LaTeX
        //MathJax.Hub.Queue(["Typeset", MathJax.Hub, el[0]]);

      } else {
        console.log("Unknown cell type: " + cell.cell_type);
      }

    } else {
      console.log("No cell source and/or cell_type: ");
      console.log(cell);
    }
  }
  MathJax.Hub.Queue(["Typeset",MathJax.Hub]);

  var kernel_name;
  try {
    kernel_name = notebook.metadata.kernelspec.name;
  } catch(e) {
    // If a kernel wasn't detected, go with python3
    kernel_name = "python3";
  }

  this.thebe = new Thebe({
    url: "https://tmp23.tmpnb.org",
    kernel_name: kernel_name || "python3"
  });
};

/**
 * Utility funciton to set up Gistie on the page
 */
gistexec = function( ) {
  var params = getUrlParams();

  //Init MathJax
  MathJax.Hub.Config({
      tex2jax: {
          inlineMath: [ ['$','$'], ["\\(","\\)"] ],
          displayMath: [ ['$$','$$'], ["\\[","\\]"] ],
          processEscapes: true,
          processEnvironments: true
      },
      // Center justify equations in code and markdown cells. Elsewhere
      // we use CSS to left justify single line equations in code cells.
      displayAlign: 'center',
      "HTML-CSS": {
          availableFonts: [],
          imageFont: null,
          preferredFont: null,
          webFont: "STIX-Web",
          //styles: {'.MathJax_Display': {"margin": 0}},
          linebreaks: { automatic: true }
      }
  });
  MathJax.Hub.Configured();


  return new Gistie(params.gistID || '8639207f3401552553e8');
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
