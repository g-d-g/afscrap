/*
| -------------------------------------------------------------------
|  Afscrap Main File
| -------------------------------------------------------------------
|
|
|	Author : PLIQUE Guillaume
|	Organization : Medialab - Sciences-Po
|	Version : 1.0
*/

// Dependancies
//-------------
var fs = require('fs');
var path = require('path');
var Forum = require('./Forum.js');
var Thread = require('./Thread.js');
var ProcessTimer = require('../tools/ProcessTimer.js');

// Main Class
//------------
function AFScraper(){

	// Object Configuration
	var self = this;
	this.max_pile = 6;
	this.num_processes = -1;
	this.cache = [];
	this.cache_directory = false;
	this.cache_file = false;


	// Main Methods
	//=============

	// Forum Loop
	//--------------
	this.fetchForum = function(forum_url, output_directory){

		// Message
		console.log('');
		console.log('Starting to fetch forum :: '.blue+forum_url);

		new Forum(forum_url, output_directory, false, function(){
			 console.log(ProcessTimer.elapsed_time());
		});
	}

	// Threads Loop
	//--------------
	this.fetchThreads = function(json_list, keywords, output_format, output_directory, json_path, mongoose){

		// Message
		console.log('');
		console.log('Starting to fetch threads'.blue);

		// Checking cache
		this.check_cache(json_path);

		// Recursive worker
		function update_processes(index){
			
			// Updating counter and confront it to cache
			self.num_processes += 1;
			while(self.cache.indexOf(self.num_processes) > -1){
				self.num_processes += 1;
			}

			// Testing existence of index
			if(json_list[self.num_processes] !== undefined){

				new Thread(
					json_list[self.num_processes].url, 
					keywords,
					output_format, 
					output_directory, 
					self.num_processes, 
					update_processes
				);
			}

			// Writing cache
			if(index !== undefined){ self.write_cache(index); }

			// Calling the end if this is the case
			if(index == json_list.length - 1){

				// Deleting Cache
				self.delete_cache();

				// Closing connection to database
				if(output_format == 'mongo'){
					mongoose.connection.close();
				}

				// Announcing
				console.log("Process Finished".green);
				if(output_format == 'mongo'){
					console.log('Get the results in mongo database'.blue);
				}
				else{
					console.log('Get the results in : '.blue+output_directory);
				}
				console.log(ProcessTimer.elapsed_time());
				console.log('');
			}
		}

		// Looping through the list while respecting pile
		if(json_list.length < this.max_pile){ this.max_pile = json_list.length}
		for(var i=1; i <= this.max_pile; i++){

			update_processes();
		}
	}

	// Text Compilation
	//-----------------
	this.compile = function(model, output_directory, callback){

		// Announcing
		console.log('');
		console.log('Starting text compilation'.blue);

		// Process
		model.count(function(err, count){
			if(count === 0){
				console.log('Error :: The given database is empty or inexistant'.red);
				end();
				return false;
			}
			else{

				// Getting threads from mongo
				model.find({}, function(err, threads){

					// Recursive function
					function update_processes(index){
						self.num_processes += 1;

						if(threads[self.num_processes] !== undefined){
							to_text(threads[self.num_processes].data, self.num_processes, update_processes);
						}

						if(index == threads.length - 1){
							end();
							return false;
						}
					}
					
					// Iterating pile
					for(var i=0; i < self.max_pile; i++){
						update_processes();
					}
				});
			}
		});


		// Text Writing
		function to_text(thread, index, callback){
			console.log(thread.author);
			callback(index);
		}

		// Closing
		function end(){

			// Message
			console.log('Process Finished'.green);
			console.log('Find the results in : '.blue+output_directory);
			console.log(ProcessTimer.elapsed_time());
			console.log('');

			// Back to ArgvParser to close connection
			callback();
		}
		
	}



	// Cache Handler
	//==============

	// Function to create cache directory
	this.check_cache = function(json_path){

		// Setting properties
		this.cache_directory = path.dirname(json_path);
		this.cache_file = path.basename(json_path, '.json')+'.cache';

		// Checking existence of cache dir.
		if(!fs.existsSync(this.cache_directory)){
				
			// The cache directory does not exist, we create it
			console.log('Creating cache directory'.blue);
			fs.mkdirSync(this.cache_directory);
		}

		// Checking existence of cache file
		if(!fs.existsSync(this.cache_directory+'/'+this.cache_file)){

			// The cache file does not exist, we create it
			console.log('Creating cache file'.blue);
			fs.writeFileSync(this.cache_directory+'/'+this.cache_file, '');

			return false;
		}

		// A cache file exist, we parse it to resume the process
		console.log('Resuming process from cache.'.green);
		var cache = fs.readFileSync(this.cache_directory+'/'+this.cache_file, 'UTF-8');
		this.cache = cache.substring(1).split(';').map(function(item){return parseInt(item);});

	}

	// Function to write cache
	this.write_cache = function(index){
		fs.appendFile(this.cache_directory+'/'+this.cache_file, ';'+index);
	}

	// Function to delete cache
	this.delete_cache = function(){
		fs.unlink(this.cache_directory+'/'+this.cache_file);
	}


}

// Launching the process
//----------------------
module.exports = new AFScraper();