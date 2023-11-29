var fs = require( "fs" );
var path = require( "path" );
var util = require( "util" );
var crypto = require( "crypto" );
var wordpress = require( "wordpress" );
var async = require( "async" );
var version = require( "./package" ).version;

exports.createClient = createClient;
exports.Client = Client;

function createClient( options ) {
	return new Client( options );
}

function Client( options ) {
	this.options = options;
	this.verbose = options.verbose || false;
	this.client = wordpress.createClient( options );
	this.bindClientMethods();
}

Client.prototype.log = console.log;
Client.prototype.logError = console.error;

Client.prototype.bindClientMethods = function() {
	var context = this;
	var client = this.client;

	function bindContext( property ) {
		if ( typeof client[ property ] !== "function" ) {
			return;
		}

		var original = client[ property ];
		client[ property ] = function() {
			if ( !arguments.length ) {
				return;
			}

			var args = [].slice.apply( arguments );
			var last = args.pop();
			if ( typeof last === "function" ) {
				last = last.bind( context );
			}
			args.push( last );

			original.apply( client, args );
		};
	}

	for ( var property in client ) {
		bindContext( property );
	}
};

Client.prototype.waterfall = function( steps, callback ) {
	var context = this;

	async.waterfall(
		steps.map(function( step ) {
			return step.bind( context );
		}),
		callback.bind( context )
	);
};

Client.prototype.forEach = function( items, eachFn, complete ) {
	async.forEachSeries( items, eachFn.bind( this ), complete.bind( this ) );
};

Client.prototype.path = function( partial ) {
	return path.join( this.options.dir, partial );
};

// Async directory recursion, always walks all files before recursing
Client.prototype.recurse = function( rootdir, walkFn, complete ) {
	complete = complete.bind( this );

	try {
		fs.statSync( rootdir );
	} catch ( e ) {
		// Directories are considered optional, especially if inherited
		// from default setttings. Treat non-existant dir as empty dir.
		complete();
		return;
	}

	fs.readdir( rootdir, { withFileTypes: true }, function( error, entries ) {
		if ( error ) {
			return complete( error );
		}

		var directories = [];
		var files = [];
		entries.forEach(function( entry ) {
			var fullPath = path.join( rootdir, entry.name );
			if ( entry.isDirectory() ) {
				directories.push( fullPath );
			} else {
				files.push( fullPath );
			}
		});

		this.forEach( files, walkFn, function( error ) {
			if ( error ) {
				return complete( error );
			}

			this.forEach( directories, function( directory, directoryComplete ) {
				this.recurse( directory, walkFn, directoryComplete );
			}, complete );
		});
	}.bind( this ));
};

Client.prototype.createChecksum = (function() {
	function flatten( obj ) {
		if ( obj == null ) {
			return "";
		}

		if ( typeof obj === "string" ) {
			return obj;
		}

		if ( typeof obj === "number" ) {
			return String( obj );
		}

		if ( util.isDate( obj ) ) {
			return obj.toGMTString();
		}

		if ( util.isArray( obj ) ) {
			return obj.map(function( item ) {
				return flatten( item );
			}).join( "," );
		}

		return Object.keys( obj ).sort().map(function( prop ) {
			return prop + ":" + flatten( obj[ prop ] );
		}).join( ";" );
	}

	return function( obj ) {
		var md5 = crypto.createHash( "md5" );
		md5.update( flatten( obj ), "utf8" );
		return md5.digest( "hex" );
	};
})();

Client.prototype.validateXmlrpcVersion = function( callback ) {
	callback = callback.bind( this );

	if ( this.verbose ) {
		this.log( "Verifying XML-RPC version..." );
	}

	this.client.authenticatedCall( "gw.getVersion", function( error, xmlrpcVersion ) {
		if ( error ) {
			if ( error.code === "ECONNREFUSED" ) {
				return callback( new Error( "Could not connect to WordPress." ) );
			}
			if ( error.code === -32601 ) {
				return callback( new Error(
					"XML-RPC extensions for Gilded WordPress are not installed." ) );
			}
			if ( !error.code ) {
				error.message += "\nPlease ensure that your database server is running " +
					"and WordPress is functioning properly.";
			}

			// XML-RPC is disabled or bad credentials
			// WordPress provides good error messages, so we don't do any special handling
			return callback( error );
		}

		// The server should have all capabilities expected by this client.
		// The server must therefore be in the "^x.y.z" semver-range, whereby it
		// implements the same major version, and the same (or newer) minor version.
		var xmlrpcVersionParts = xmlrpcVersion.split( ".", 3 ).map( parseFloat );
		var clientVersionParts = version.split( ".", 3 ).map( parseFloat );

		if ( !( xmlrpcVersionParts[0] === clientVersionParts[0] && xmlrpcVersionParts[1] >= clientVersionParts[1] ) ) {
			return callback( new Error( "Incompatible versions for Gilded WordPress. " +
				"Version " + version + " is installed as a Node.js module, " +
				"but the WordPress server is running version " + xmlrpcVersion + "." ) );
		}

		if ( this.verbose ) {
			this.log( "XML-RPC version matches Node.js version." );
		}

		callback( null );
	});
};

Client.prototype.validate = function( callback ) {
	this.waterfall([
		this.validateXmlrpcVersion,
		this.validateTerms,
		this.validatePosts
	], function( error ) {
		if ( error ) {
			return callback( error );
		}

		callback( null );
	});
};

Client.prototype.sync = function( callback ) {
	this.waterfall([
		this.syncTerms,
		this.syncPosts,
		this.syncResources
	], function( error ) {
		if ( error ) {
			if ( error.code === "ECONNREFUSED" ) {
				this.logError( "Could not connect to WordPress XML-RPC server." );
			}

			return callback( error );
		}

		callback( null );
	});
};

[ "posts", "taxonomies", "resources" ].forEach(function( module ) {
	require( "./lib/" + module )( Client );
});
