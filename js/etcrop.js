var landing;
var dashboard;
var info;
var stations;
var userLocation;
var nearestStationName;
var nearestStationDistance;
var weather;
var currentDateTime;
var etref;
var etcrop;
var cropCoefficient;


var canopyCoverContainer;
var cropCoefficientContainer;
var etrefContainer;
var etcropContainer;
var imageOriginalContainer;
var imageClassifiedContainer;

var cameraUpload;

function preload() {
    //stations = loadTable('data/stations.csv','csv','header');
    if(geoCheck() == true){
        userLocation =  getCurrentPosition(openweathermap);
	}else{
		alert('Geolocation is disabled. Enable phone geolocation in your phone settings and then refresh the page.')
	}
}



function setup() {
    noCanvas();

    // Display running version
    console.log('Running etcrop v1.0')

    // Get date and time
    currentDateTime = new Date();

    // Camera button
    cameraBtn = document.getElementById('camera-btn');
    cameraUpload = createFileInput(gotFile);
    cameraUpload.parent("camera-btn");
    cameraBtn.children[0].style.display = "none"
    

    // Landing
    landing = document.getElementById('landing');

    // Location
    info = document.getElementById('info');

    // Dashboard
    dashboard = document.getElementById('dashboard');

    // Dashboard components
    latitudeContainer = document.getElementById('latitude-value');
    longitudeContainer = document.getElementById('longitude-value');
    datetimeContainer = document.getElementById('datetime-value');
    statusContainer = document.getElementById('status-value');

    //nearestStationNameContainer = document.getElementById('nearest-station-name');
    //nearestStationDistanceContainer = document.getElementById('nearest-station-distance');

    canopyCoverContainer = document.getElementById('canopy-cover-value');
    cropCoefficientContainer = document.getElementById('crop-coefficient-value');
    etrefContainer = document.getElementById("etref-value");
    etcropContainer = document.getElementById('etcrop-value');
    imageOriginalContainer = document.getElementById('image-original');
    imageClassifiedContainer = document.getElementById('image-classified');

    //computeStationDistances()
    //findNearestStation()
    //requestNearestStationData()

    // Set datetime and location dashboard values
    latitudeContainer.innerText = userLocation.latitude.toFixed(6);
    longitudeContainer.innerText = userLocation.longitude.toFixed(6);
    datetimeContainer.innerText = currentDateTime.toLocaleString();
    statusContainer.innerText = "Ready"
    //nearestStationNameContainer.innerText = nearestStationName;
    //nearestStationDistanceContainer.innerText = Math.round(nearestStationDistance*100)/100;
    info.style.display = "block";
}



// FUNCTIONS
function computeStationDistances(){

    let N = stations.getRowCount()
    for(let i=0; i<N; i++){
        let stationLat = float(stations.getColumn("LATITUDE")[i]);
        let stationLon = float(stations.getColumn("LONGITUDE")[i]);
        let userLat = float(userLocation.latitude);
        let userLon = float(userLocation.longitude);
        let stationDistance = distance(userLat,userLon,stationLat,stationLon);
        stations.set(i, 'DISTANCE', stationDistance);
    }
    console.log('Done computing distances')
}

function findNearestStation(){
    let distances = stations.getColumn("DISTANCE")
    let idxNearest = distances.indexOf(Math.min(...distances));
    nearestStationName = stations.get(idxNearest,"NAME");
    nearestStationDistance = stations.get(idxNearest,"DISTANCE")
    console.log('Done finding nearest station')

}

function requestNearestStationData(){
    let root = "http://mesonet.k-state.edu/rest/stationdata/?"

    let yesterdayDate = new Date(new Date().getTime() - 86400000);
    let yyyy = yesterdayDate.getFullYear().toString();
    let mm = yesterdayDate.getMonth() + 1;
    if(mm<10){
        mm = "0" + mm.toString();
    }else{
        mm = mm.toString();
    }
    let dd = yesterdayDate.getDate();
    if(dd<10){
        dd = "0" + dd.toString();
    }else{
        dd = dd.toString();
    }
    let HH = "00"
    let MM = "00"
    let SS = "00"

    let startDate = yyyy.toString() + mm + dd + HH + MM + SS;
    let endDate = startDate;
    let vars = "TEMP2MMIN,TEMP2MMAX,RELHUM2MMIN,RELHUM2MMAX,WSPD2MAVG,SR"

    let URL = root + 'stn=' + nearestStationName + '&int=day' + '&t_start=' + startDate + '&t_end=' + endDate + "&vars=" + vars;
    weather = loadTable(URL,'csv','header');
}



function romanenko(){
    // Proposed by Romanenko in 1961

    // Compute sum of weather variables
    let TempSum = 0;
    let RHSum = 0;

    let N = weather.hourly.length;
    for(let i=0; i<N; i++){
        TempSum += (weather.hourly[i].temp - 273.15);
        RHSum += weather.hourly[i].humidity;
    }

    // Compute mean temperature and relative humidity
    let TempMean = TempSum/N
    let RHMean = RHSum/N

    // Calculate reference ET using the Romanenko method with custom parameters (temperature-based method)
    etref = 0.000055*(27.2+TempMean)**2 * (100-RHMean);
}

function dalton(){
    // Proposed by Dalton in 1802

    // Compute sum of weather variables
    let windSpeedSum = 0;
    let vpdSum = 0;

    let N = weather.hourly.length;
    for(let i=0; i<N; i++){

        // Get weather variables from OpenWeatherMap API response
        let T = weather.hourly[i].temp - 273.15;
        let RH = weather.hourly[i].humidity
        let W = weather.hourly[i].wind_speed;

        // Compute vapor pressur deficit for each hour
        let es = 0.6108 * Math.exp(17.27 * (T) / (T + 237.3));
        let ea = es * (RH/100);
        let vpd = es - ea;

        // Compute sums to compute means
        vpdSum += vpd;
        windSpeedSum += W
    }

    // Compute average wind speed and vapor pressure deficit
    let windSpeedMean = windSpeedSum/N
    let vpdMean = vpdSum/N

    // Calculate reference ET using Dalton's method (mass transfer method)
    etref = (2.6 + 0.30*windSpeedMean)*vpdMean; //(5.3 0.07)
}

function openweathermap(){
    let dt = parseInt(( (new Date().getTime() - 24*60*60*1000) / 1000).toFixed(0));
    let URL = "https://api.openweathermap.org/data/2.5/onecall/timemachine?lat=" + userLocation.latitude + "&lon=" + userLocation.longitude + "&dt=" + dt + "&appid=99fe4ecff5e236e5a687ccc63fd1a7c4";
    console.log(URL)
    weather = loadJSON(URL, dalton)
}


function dayOftheYear(){
    var today = new Date();
    var start = new Date(today.getFullYear(), 0, 0); // Constructing the Jan 1 for the given year
    var diff = today - start; // time differnece by second
    var oneDay = 1000 * 60 * 60 * 24;
    var days = Math.floor(diff / oneDay); // calculate days 
    return days;
}


function etcropfn(cc){
    cropCoefficient = (1.1 * (cc/100) + 0.17);
    etcrop = etref * cropCoefficient;
}


function gotFile(file) {
    if (file.type === 'image'){
        loadImage(file.data,function(imgOriginal){
            getCurrentPosition(); //update recent location to the local storage. 

            // Get upload timestamp
            currentDateTime = new Date();
            
            // Resize image so that the largest side has 1440 pixels
            if(imgOriginal.width>=imgOriginal.height){
                imgOriginal.resize(1440,0); 
            } else {
                imgOriginal.resize(0,1440);
            }
            imgOriginal.loadPixels();
            
            
            // Initiatve classified image
            imgClassified = createImage(imgOriginal.width, imgOriginal.height);
            imgClassified.loadPixels();

            // Classify image following manuscript settings
            let RGratio = 0.95;
            let RBratio = 0.95;
            let greenPixels = 0;

            for(let y=0; y<imgClassified.height; y++){
                for(let x=0; x<imgClassified.width; x++){
                    let index = (x + y * imgClassified.width)*4;
                
                    let R = float(imgOriginal.pixels[index+0]);
                    let G = float(imgOriginal.pixels[index+1]);
                    let B = float(imgOriginal.pixels[index+2]);
                
                    if (R/G < RGratio && B/G < RBratio && 2*G-R-B>20){
                        imgClassified.pixels[index+0] = 255;
                        imgClassified.pixels[index+1] = 255;
                        imgClassified.pixels[index+2] = 255;
                        imgClassified.pixels[index+3] = 255;
                        greenPixels += 1;
                        
                    } else {
                        imgClassified.pixels[index+0] = 0;
                        imgClassified.pixels[index+1] = 0;
                        imgClassified.pixels[index+2] = 0;
                        imgClassified.pixels[index+3] = 255;
                    }
                }
            }

            imgClassified.updatePixels();
            percentCanopyCover = greenPixels/(imgClassified.width * imgClassified.height)*100;

            // Compute ET crop
            etcropfn(percentCanopyCover)

            // Update location values
            latitudeContainer.innerText = userLocation.latitude.toFixed(6);
            longitudeContainer.innerText = userLocation.longitude.toFixed(6);
            datetimeContainer.innerText = currentDateTime.toLocaleString();

            // Update dashboard values
            canopyCoverContainer.innerText = percentCanopyCover.toFixed(1);
            cropCoefficientContainer.innerText = cropCoefficient.toFixed(2);
            etrefContainer.innerText = etref.toFixed(2);
            etcropContainer.innerText = etcrop.toFixed(2);

            // Add dashboard original image
            dashboardOriginalImage = createImg(imgOriginal.canvas.toDataURL(),'original image');
            dashboardOriginalImage.parent('orignal-image');

            // Add dashboard classified image
            dashboardClassifiedImage = createImg(imgClassified.canvas.toDataURL(),'classified image');
            dashboardClassifiedImage.parent('classified-image');

            // Hide landing
            landing.style.display = "none";
            
             // Displaying the result grid 
             info.style.visibility = 'visible';
             info.style.display = 'block';
 
             dashboard.style.visibility = 'visible';
             dashboard.style.display = "block";

        });

    } else {
        alert("The selected file is not supported. Please load an image in .JPG or .PNG format")
        }
}