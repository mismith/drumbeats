angular.module('drumbeats', ['firebase', 'firebaseHelper'])
	
	.controller('AppCtrl', function($scope, $rootScope, $firebaseHelper){
		$rootScope.console = console;
	})
	
	.controller('BeatCtrl', function($scope, $rootScope, $timeout){
		$scope.beat = {
			name: 'Beginner',
			
			// time signature
			beatsPerBar: 4,
			beatUnit: 4,
			barsPerMeasure: 2,
			
			// data
			channels: [
				{
					name: 'Bass',
					notes: [3, 7, 11, 15],
				},
				{
					name: 'HiHat',
					notes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
				},
				{
					name: 'Snare',
					notes: [1, 5, 9, 13],
				},
				{
					name: 'Ride',
					//notes: [7],
				},
				{
					name: 'Crash',
					//notes: [17],
				},
				{
					name: 'HiTom',
					//notes: [16.25],
				},
				{
					name: 'LoTom',
					//notes: [16.5],
				},
				{
					name: 'FloorTom',
					//notes: [16.75],
				},
			],
		};
		
		// timing
		var beatsPerMeasure = function(beat){
			return beat.beatsPerBar * beat.beatUnit;
		};
		var setSpots = function(beat){
			$scope.spots = [];
			for(var i = 1; i <= beatsPerMeasure(beat) + 1; i += beat.beatsPerBar/beatsPerMeasure(beat)) $scope.spots.push(i);
		}
		setSpots($scope.beat);
		
		var setGuides = function(beat){
			$scope.guides = [];
			for(var i = 1; i <= beatsPerMeasure(beat) + 1; i += beat.beatsPerBar/beatsPerMeasure(beat)) $scope.guides.push((i - 1) % beat.beatsPerBar ? -i : i);
		}
		setGuides($scope.beat);
		
		$scope.$watch('beat.beatsPerBar', function(){
			setSpots($scope.beat);
			setGuides($scope.beat);
		});
		$scope.$watch('beat.beatUnit', function(){
			setSpots($scope.beat);
			setGuides($scope.beat);
		});
		
		var now = function(){ return +new Date; };
		var $marker = $rootScope.$marker = {
			position: 0,
			$bpm: 90,
			bpm: function(set){
				if(set) $marker.$bpm = set;
				return $marker.$bpm;
			},
			$start: now(),
			$playing: false,
			play: function(bpm){
				if(bpm) $marker.bpm(bpm);
				
				$marker.$playing = true;
				$marker.$start = now() - ($marker.$paused || 0);
				
				requestAnimationFrame($marker.$refresh);
			},
			pause: function(){
				$marker.$playing = false;
				$marker.$paused = now() - $marker.$start;
			},
			stop: function(){
				$marker.$start = now() + 1000;
				$marker.$playing = false;
				$marker.$paused = 0;
			},
			$refresh: function(){
				$scope.$apply(function(){
					var elapsed = now() - $marker.$start;
					period = 1000 * 60 / $marker.$bpm * $scope.beat.beatsPerBar * $scope.beat.barsPerMeasure;
					$marker.position = Math.max(0, (elapsed % period) / period);
				});
				
				if($marker.$playing) requestAnimationFrame($marker.$refresh);
			},
		};
		$marker.play();
		
		// display
		$scope.number = function(note){
			if(angular.isNumber(note)){
				return note;
			}else if(angular.isObject(note)){
				return note.beat;
			}
		};
		$scope.progress = function(note, beat, noAdjust){
			// subtract half a width to center on measure
			return (Math.max(0, Math.abs($scope.number(note)) - 1)) / (beat.beatsPerBar * beat.barsPerMeasure);
		};
		$scope.lyric = function(guide, beat, returnType){
			var mod = (Math.abs(guide) - 1) % 1;
			//if(returnType) return parseInt(mod * beat.beatsPerBar);
			
			if(mod == 0){
				return returnType ? 'note' : (Math.abs(guide) - 1) % beat.beatsPerBar + 1;
			}else if(mod <= 1/4){
				return 'e';
			}else if(2/3 <= mod){
				return 'a';
			}else{
				return returnType ? 'and' : '&';
			}
		};
		
		// editing
		$scope.addNote = function(channel, spot){
			if( ! channel.notes) channel.notes = [];
			
			channel.notes.push(spot);
		};
		$scope.alterNote = function(channel, note){
			var i = channel.notes.indexOf(note);
			console.log(i, note);
			if(i >= 0) channel.notes[i] = -channel.notes[i];
		};
		$scope.removeNote = function(channel, note){
			if( ! channel.notes) channel.notes = [];
			
			var i = channel.notes.indexOf(note);
			if(i >= 0) channel.notes.splice(i, 1);
		};
		$scope.shiftNotes = function(amount){
			if( ! amount) return;
			
			angular.forEach($scope.beat.channels, function(channel){
				angular.forEach(channel.notes, function(note, i){
					channel.notes[i] += amount;
				});
			});
			console.log($scope.beat);
		};
		
	})
	
	.filter('filterNotesByMeasure', function(){
		return function(array, beat, measure){
			if( ! array) return array;
			
			var min = (measure - 1) * beat.beatsPerBar * beat.barsPerMeasure,
				max = (measure - 0) * beat.beatsPerBar * beat.barsPerMeasure;
			
			return array.filter(function(v){
				return v > min && v <= max;
			});
		};
	})