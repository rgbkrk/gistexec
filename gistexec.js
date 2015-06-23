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
  console.log(this.gist);
  this.files = gist.files;

  for (var filename in gist.files) {
    if(!gist.files.hasOwnProperty(filename)) {
      continue;
    }

    var file = gist.files[filename];

    filename = filename.toLowerCase();

    if (filename.includes('.ipynb')) {
      this._renderFile(file, this.renderNotebook);
    } else if (filename.includes('.md')){
      this._renderFile(file, this.renderMarkdown);
    } else if (filename.includes('.rmd')) {
      this._renderFile(file, this.renderRMarkdown);
    }
  }
};

Gistie.prototype._renderFile = function(file, cb) {
  if (file.truncated) {
    console.log("File truncated, fetching raw URL");
    $.ajax({
      url: file.raw_url,
      success: cb.bind(this)
    });
  } else {
    console.log("File small enough to render straight from gist API");
    cb(file.content);
  }
};

/**
 * Tickles the notebook server's contents API to sneakily upload data
 *
 * resp = requests.put("http://127.0.0.1:8888/user/neNUk0HdyfGm/api/contents/that.py",
 *                     json={'type': 'file', 'format': 'text', 'content': "import this"})
 */
upload = function(base_server, filepath, content) {
  fetch(base_server + filepath, {
    method: 'put',
    body: JSON.stringify({
      type: 'file',
      format: 'text', // TODO: This is definitely an assumption...
      content: content
    }),
    headers: {
      'Accept': 'application/json'
    }
  });
};

Gistie.prototype.renderMarkdown = function(markdown) {
  var $container = $('#container');
  $container.empty();
  var renderer = new marked.Renderer();

  var kernel_name;

  // TODO: Something sensible about language detection
  // For now, just accept the last rendered code cell as the language
  // TODO: mapping from language -> kernel_name

  // Here we override to bring Thebe flavored cells
  renderer.code = function(code, language) {
    kernel_name = language;
    return '<pre data-executable=\'true\'>' + code + '</pre>\n';
  };

  marked.setOptions({
    renderer: renderer,
  });

  var html = marked(markdown);
  var el = $container.append(html);

  this.thebe = new Thebe({
    url: "https://tmp23.tmpnb.org",
    kernel_name: kernel_name || "python3"
  });

};

function splitFrontMatter(doc) {
  var re = /^(-{3}(?:\n|\r)([\w\W]+?)-{3})?([\w\W]*)*/;
  var results = re.exec(doc);

  return {
    "front": jsyaml.load(results[2]),
    "markdown": results[3]
  };

}


Gistie.prototype.renderRMarkdown = function(rmarkdown) {
  var $container = $('#container');
  $container.empty();

  var matter = splitFrontMatter(rmarkdown);

  var front = matter.front;
  var markdown = matter.markdown;

  var titleComponents = [];

  if (front.title) {
    $container.append('<h1>' + front.title + '</h1>');
    titleComponents.push(front.title);
  }
  if (front.author) {
    $container.append('<p><i>' + front.author + '</i></p>');
    titleComponents.push(front.author);
  }
  if (front.date) {
    $container.append('<p><i>' + front.date + '</i></p>');
    titleComponents.push(front.date);
  }

  document.title = titleComponents.join(' - ');

  var renderer = new marked.Renderer();

  // Here we override to bring Thebe flavored cells
  renderer.code = function(code, chunkHeader) {
    // TODO: validate chunkHeader
    // TODO: extract chunkOptions
    return '<pre data-executable=\'true\'>' + code + '</pre>\n';
  };

  marked.setOptions({
    renderer: renderer,
  });

  var html = marked(markdown);
  var el = $container.append(html);

  this.thebe = new Thebe({
    url: "https://tmp23.tmpnb.org",
    kernel_name: "ir"
  });

};


/**
 * Render a notebook on the DOM. Likely ugly.
 * @param {Object} notebook Jupyter Notebook document
 */
Gistie.prototype.renderNotebook = function(notebook) {
  // TODO: Check that it's really a notebook (existence of content key)
  console.log("Rendering notebook");

  notebook = JSON.parse(notebook);

  var $container = $('#container');
  $container.empty();

  var cell;

  if (notebook.hasOwnProperty('worksheets')) {
    // Slight conversion from < v4 notebook to v4
    notebook.cells = notebook.worksheets[0].cells;
    for (cellID = 0; cellID < notebook.cells.length; cellID++ ) {
      cell = notebook.cells[cellID];
      cell.source = cell.input;
    }
  }

  for (cellID = 0; cellID < notebook.cells.length; cellID++ ) {
    cell = notebook.cells[cellID];
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

  if (!params.gistID) {
    return;
  }

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

  if (params.gistID) {
    return new Gistie(params.gistID);
  }
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
