/* Tracker Search Provider for Gnome Shell
  *
  * Copyright (c) 2012 Christian Weber, Felix Schultze
  *
  * This programm is free software; you can redistribute it and/or modify
  * it under the terms of the GNU General Public License as published by
  * the Free Software Foundation; either version 3 of the License, or
  * (at your option) any later version.
  *
  */

const Main = imports.ui.main;
const Search = imports.ui.search;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const Util = imports.misc.util;

/* let xdg-open pick the appropriate program to open/execute the file */
const DEFAULT_EXEC = 'xdg-open';
/* Limit search results, since number of displayed items is limited */
const MAX_RESULTS = 15;

var trackerSearchProvider = null;

function TrackerSearchProvider() {
     this._init();
}

TrackerSearchProvider.prototype = {
     __proto__ : Search.SearchProvider.prototype,

     _init : function(name) {
         Search.SearchProvider.prototype._init.call(this, "Tracker Search");
     },

     getResultMeta : function(resultId) {
         let type = resultId.contentType;
         let name = resultId.filename;
         return {
             'id' : resultId,
             'name' : name,
             'createIcon' : function(size) {
                 let icon = Gio.app_info_get_default_for_type(type,null).get_icon();
                 return imports.gi.St.TextureCache.get_default().load_gicon(null, icon, size);
             }
         };
     },

     activateResult : function(id) {
         // Action executed when clicked on result
         var target = id.fileAndPath;
         Util.spawn([ DEFAULT_EXEC, target ]);
     },

     getInitialResultSet : function(terms) { // terms holds array of search items
         let results = [];
         /* build tracker command line with arguments */
         var searchString = [];
         searchString.push("tracker-search");
         searchString.push("-l");
         searchString.push(String(MAX_RESULTS));
         searchString.push("-f");
         for ( var i = 0; i < terms.length; i++) {
             searchString.push(terms[i]);
         }
         /* execute tracker-search in terminal*/
         let[res, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(
                 null, searchString, null, GLib.SpawnFlags.SEARCH_PATH, null);
         /* read terminal output */
         out_reader = new Gio.DataInputStream({
             base_stream : new Gio.UnixInputStream({
                 fd : out_fd
             })
         });

         var size;
         var out;
         [out, size] = out_reader.read_line(null);

         var cnt = 0;
         while (size > 0 && cnt < MAX_RESULTS) {

             // Extract filename from line
             var splitted = String(out).split('/');
             var filename = decodeURI(splitted[splitted.length - 1]);
             let ft = String(filename).split('.');
             // Extract filetype
             var fileType;
             if (ft.length > 0) {
                 fileType = String(ft[ft.length - 1]);
             }
             fileType = fileType.toUpperCase();
             // extract path and filename
             splitted = String(out).split('ile://');
             var fileAndPath = "";
             if (splitted.length == 2) {
                 fileAndPath = decodeURI(splitted[1]);
             }
             // contentType is an array, the index "1" set true,
             // if function is uncertain if type is the right one
             let contentType = Gio.content_type_guess(fileAndPath, null);
             if (cnt != 0) { // skip first entry of tracker-search output
                 var newContentType = contentType[0];
                 if(contentType[1])
                 {
                     if(newContentType == "application/octet-stream")
			if (ft.length == 1) {		// mime type of folders are wrongly reported as octect-streams
				newContentType = "inode/directory";
			} else {
                         	newContentType = "text/x-log"; // unrecognized mime-types are set to text, so that later an icon can be picked
			}
                 }
                 results.push({
                     'filename' : filename,
                     'fileAndPath' : fileAndPath,
                     'fileType' : fileType,
                     'contentType' : newContentType
                 });
             }
             [out, size] = out_reader.read_line(null);
             cnt++;
         }

         if (results.length > 0) {
             return (results);
         }
         return [];
     },

     getSubsearchResultSet : function(previousResults, terms) {
         return this.getInitialResultSet(terms);
     },
};

function init(meta) {
}

function enable() {
         trackerSearchProvider = new TrackerSearchProvider();
         Main.overview.addSearchProvider(trackerSearchProvider);
}

function disable() {
         Main.overview.removeSearchProvider(trackerSearchProvider);
         trackerSearchProvider = null;
}

