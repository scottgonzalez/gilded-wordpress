# Gilded WordPress

Easily synchronize content between the file system and WordPress.

Support this project by [donating on Gratipay](https://gratipay.com/scottgonzalez/).



## TOC

* [Getting Started](#getting-started)
* [Installation](#installation)
* [Usage](#usage)
* [Node.js API](#nodejs-api)
  * [Exports](#exports)
  * [Client Methods - Validation](#client-methods---validation)
  * [Client Methods - Synchronization](#client-methods---synchronization)
  * [Client Methods - Logging](#client-methods---logging)
  * [Client Methods - Utilities](#client-methods---utilies)
  * [Directory Structure](#directory-structure)
  * [taxonomies.json](#taxonomiesjson)
  * [Post Files](#post-files)
* [PHP API](#php-api)
* [Permissive Uploads](#permissive-uploads)
* [License](#license)



## Getting Started

Resources are uploaded to `/gw-resources/{HOME_URL}/`. If you'd like a friendlier name, you can set up a redirect in your web server.

If you have problems uploading resources, check the [Permissive Uploads](#permissive-uploads) section.



## Installation

```
npm install gilded-wordpress
```



## Usage

```javascript
var wordpress = require( "gilded-wordpress" );
var client = wordpress.createClient({
	url: "wordpress.dev",
	username: "admin",
	password: "admin",
	dir: "my-content"
});

client.sync(function( error ) {
	if ( error ) {
		console.error( error );
		return;
	}

	console.log( "Successfully synchronized WordPress." );
});
```



## Node.js API

### Exports

#### wordpress.createClient( options )

Creates a new client instance.

* `options`: A hash of options that apply to all requests for the new client.
  * `username`: The username for the WordPress account.
  * `password`: The password for the WordPress account.
  * `url`: The URL for the WordPress install.
  * `dir`: The path to the directory containing all taxonomies, posts, and resources (see [Directory Struture](#directory-structure)).
  * `host` (optional): The actual host to connect to if different from the URL, e.g., when deploying to a local server behind a firewall.
  * `blogId` (optional; default: `0`): The blog ID for the WordPress install.
  * `verbose` (optional; default: `false`): Whether logging should be verbose.

#### wordpress.Client

The constructor used for client connections. Useful for creating extensions.



### Client Methods - Validation

#### client.validate( callback )

Validates all data.

* `callback` (`function( error )`): A callback to invoke when the validation is complete.

#### client.validateXmlrpcVersion( callback )

Verifies whether the WordPress plugin is installed and has the same version as the Node.js module.

* `callback` (`function( error )`): A callback to invoke when the validation is complete.

#### client.validateTerms( callback )

Validates all terms.

* `callback` (`function( error )`): A callback to invoke when the taxonomies have been validated.

### client.validatePosts( callback )

Validates all posts.

* `callback` (`function( error )`): A callback to invoke when the posts have been validated.



### Client Methods - Synchronization

#### client.sync( callback )

Synchonizes all data.

* `callback` (`function( error )`): A callback to invoke when the synchronization is complete.

#### client.syncTerms( callback )

Synchronizes all terms.

* `callback` (`function( error )`): A callback to invoke when the taxonomies have been synchronized.

#### client.syncPosts( callback )

Synchronizes all posts.

* `callback` (`function( error )`): A callback to invoke when the posts have been synchronized.

#### client.syncResources( callback )

Synchronizes all resources.

* `callback` (`function( error )`): A callback to invoke when the resources have been synchronized.



### Client Methods - Logging

The client methods log various information as they perform their tasks. These methods are designed to be overridden for custom logging or to hook into an existing logging system.

#### client.log( message )

Logs a message. Defaults to `console.log()`.

* `message`: A message to log.

#### client.logError( message )

Logs an error message. Defaults to `console.error()`.

* `message`: An error message to log.



### Client Methods - Utilities

The utility methods exist to help build custom extensions to the client. All callbacks from the utility methods are invoked within the context of the client instance.

#### client.waterfall( steps, callback )

Asynchronously executes a set of functions.

Equivalent to [`async.waterfall()`](https://github.com/caolan/async#waterfall), but with context preserved.

* `steps`: An array of functions to perform. Each function is passed a callback (`function( error, result1, result2, ... )`) which must be called when the function is complete. The first argument is an error and any further arguments will be passed as arguments in order to the next step.
* `callback` (`function( error )`): A callback to invoke when all steps have been completed or a step has resulted in an error.

#### client.forEach( items, iterator, complete )

Asynchronous version of `Array#forEach()`.

Equivalent to [`async.forEachSeries()`](https://github.com/caolan/async#forEachSeries), but with context preserved.

* `items`: An array to iterate over.
* `iterator` (`function( item, callback )`): A callback to invoke for each item of the array.
  * `item`: The current item of the array.
  * `callback` (`function( error )`): A callback to invoke after processing the item.
* `complete` (`function( error )`): A callback to invoke when all items have been iterated over or an item resulted in an error.

#### client.recurse( dir, iterator, complete )

Asyncrhonously walk all files in a directory, recursively. All files within a directory are walked before recursing.

* `dir`: The path to a directory to walk.
* `iterator` (`function( path, callback )`): A callback to invoke for each file within the directory.
  * `path`: The path to the current file.
  * `callback` (`function( error )`): A callback to invoke after processing the file.
* `complete` (`function( error )`): A callback to invoke when all files have been iterated over or a file resulted in an error.



### Directory Structure

The directory passed to the client instance has the following structure:

```
dir
├── posts
│   └── <post_type>
│       └── <post_name>.html
├── resources
│   └── <file>.<ext>
└── taxonomies.json
```

The `posts` directory must only contain `<post_type>` directories.
The `<post_type>` directories must be named to exactly match a post type, e.g., `post` or `page`.
All custom post types are supported.

The `resources` directory is completely freeform.
Resources of any type will be uploaded based on the current directory structure.

### taxonomies.json

The `taxonomies.json` file defines all used taxonomy terms.
You can only manage terms, all taxonomies much already exist in WordPress.

```json
{
	"<taxonomy_name>": [
		{
			"name": "My Term",
			"description": "My term is awesome",
			"slug": "my-term"
		},
		{
			"name": "My Other Term",
			"slug": "my-other-term",
			"children": [
				{
					"name": "I'm a child term!",
					"slug": "hooray-for-children"
				}
			]
		}
	]
}
```

Slugs and names are required.

### Post Files

Post files must be HTML, containing the content of the post.
Post data can be specified as JSON in a `<script>` element at the top of the file.

```html
<script>{
	"title": "My Post",
	"termSlugs": {
		"<taxonomy_name>": [
			"<hierarchical_slug>"
		]
	}
}</script>
<p>I'm a post!</p>
```

The post type and parent are determined based on the [directory structure](#directory-structure).
`termSlugs` must match a hierarchical slug defined in [taxonomies.json](#taxonomiesjson).



## PHP API

### Constants

#### GW_VERSION

The installed version of Gilded WordPress.

#### GW_RESOURCE_DIR

The path to the resources directory for the current site.

### Methods

#### gw_resources_dir( url )

Gets the resources directory for a specific site.

* `url`: The URL for the site.



## Permissive Uploads

Depending on what resources you're uploading, you may need to change some WordPress settings.
Here are a few settings that might help:

```php
// Disable more restrictive multisite upload settings.
remove_filter( 'upload_mimes', 'check_upload_mimes' );

// Give unfiltered upload ability to super admins.
define( 'ALLOW_UNFILTERED_UPLOADS', true );

// Allow additional file types.
add_filter( 'upload_mimes', function( $mimes ) {
	$mimes[ 'eot' ] = 'application/vnd.ms-fontobject';
	$mimes[ 'svg' ] = 'image/svg+xml';
	$mimes[ 'ttf' ] = 'application/x-font-ttf';
	$mimes[ 'woff' ] = 'application/font-woff';
	$mimes[ 'xml' ] = 'text/xml';
	$mimes[ 'php' ] = 'application/x-php';
	$mimes[ 'json' ] = 'application/json';
	return $mimes;
});

// Increase file size limit to 1GB.
add_filter( 'pre_site_option_fileupload_maxk', function() {
	return 1024 * 1024;
});
```



## License

Copyright 2014 Scott González. Released under the terms of the MIT license.

---

Support this project by [donating on Gratipay](https://gratipay.com/scottgonzalez/).
