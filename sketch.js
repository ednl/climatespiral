// Data properties
const anomin  = -1.0;        // anomaly value at the origin (must be < 0)
const anomax  =  1.5;        // anomaly value at the edge (must be > 0)
const refs    = [0, 1, 1.5]; // reference circles
const invalid = '***';

// Visualisation parameters
const canvassize  = 800;  // square canvas width and height in pixels
const bgcolour    = 0;    // black
const gridcolour  = 102;  // grey
const axescolour  = 153;  // light grey
const labelcolour = 255;  // white
const ticksize    = 0.03; // size of ticks on axes in scaled coordinates
const margin      = 0.12; // 12% margin around the graph, month labels go here
let cool, neutral, warm;  // temperature anomaly colours defined in setup()

// Derived constants for internal use
const range       = anomax - anomin;               // axes go from -range to +range in scaled coordinates
const origin      = canvassize / 2;                // origin centered on the canvas
const scalefactor = origin / (1 + margin) / range; // for graph grid [-range..+range] with 12% margin
const pixelsize   = 1 / scalefactor;               // size of 1 pixel in scaled coordinates
const borderdist  = origin * pixelsize;            // distance from origin to canvas border in scaled coordinates
const textheight1 = 20 * borderdist / 400;         // 20px in scaled coordinates (for canvassize=800)
const textheight2 = 50 * borderdist / 400;         // 50px in scaled coordinates (for canvassize=800)
const label_n = 12;                                // number of labels = 12 months in a year
const label_a = 2 * Math.PI / label_n;             // label angle = month labels 30 degrees apart
const label_r = -range * (1 + margin / 2) + 2 * pixelsize; // label radius = month labels in middle of margin, start at centre-top, 2px correction for textAlign(..,CENTER) not working!
const rangelog = (Math.exp(range) - 1) / range;    // range scaling for logarithmic graph

// Variables
let func = rlin;         // axis scaling = linear (rlin), quadratic (rsqr), logarithmic (rlog)
let data, labels;        // labels = month names from CSV header row
let index = 0, maxindex; // animation progression, number of data points on file
let dir;                 // direction vectors corresponding to labels (=month names)
let chkGrid, chkAxes, chkTicks, scaling; // checkboxes and radiobutton collection

// Linear translation from degrees celsius to circle radius
function rlin(celsius) {
    const dist = celsius - anomin;
    return dist > 0 ? dist : 0; // linear map [min..max] => [0..range]
}

// Quadratic translation from degrees celsius to circle radius
function rsqr(celsius) {
    const dist = celsius - anomin;
    return dist > 0 ? Math.sqrt(dist * range) : 0; // sqrt map [min..max] => [0..range]
}

// Logarithmic translation from degrees celsius to circle radius
function rlog(celsius) {
    const dist = celsius - anomin;
    return dist > 0 ? Math.log(1 + dist * rangelog) : 0; // log map [min..max] => [0..range]
}

// Show grid, gridstep must be > 0
function showgrid(gridstep) {
    stroke(gridcolour);
    strokeWeight(0.5 * pixelsize);
    noFill();
    // Gridlines on the axes
    line(0, -borderdist, 0, borderdist);
    line(-borderdist, 0, borderdist, 0);
    // Other gridlines
    const count = Math.round(range / gridstep); // how many steps from min to max
    for (let i = 1; i <= count; ++i) {
        const c = anomin + i * gridstep;    // temperature anomaly in celsius
        const r = func(c);                      // circle radius
        line(r, -borderdist, r, borderdist);
        line(-r, -borderdist, -r, borderdist);
        line(-borderdist, r, borderdist, r);
        line(-borderdist, -r, borderdist, -r);
    }
}

// Show axes, and ticks if tickstep > 0
function showaxes(tickstep) {
    stroke(axescolour);
    strokeWeight(1 * pixelsize);
    noFill();
    // Axes
    line(0, -borderdist, 0, borderdist);
    line(-borderdist, 0, borderdist, 0);
    // Ticks
    if (tickstep > 0) {
        const count = Math.round(range / tickstep); // how many steps from min to max
        for (let i = 1; i <= count + 1; ++i) {      // one more outside the last gridline
            const c = anomin + i * tickstep;    // temperature anomaly in celsius
            const r = func(c);                      // circle radius
            line(r, -ticksize, r, ticksize);
            line(-r, -ticksize, -r, ticksize);
            line(-ticksize, r, ticksize, r);
            line(-ticksize, -r, ticksize, -r);
        }
    }
}

// Colour gradient depends on temperature anomaly in degrees celsius
function gradient(celsius) {
    if (celsius >= 0)
        return lerpColor(neutral, warm, celsius / anomax); // anomylymax > 0
    return lerpColor(neutral, cool, celsius / anomin);     // anomalymin < 0
}

// Reference circle for the climate spiral
function refcircle(celsius) {
    const c = gradient(celsius); // colour
    const r = func(celsius);     // circle radius
    textSize(textheight1);       // set before call to textWidth()
    const labeltext = nf(celsius, 1, 1) + '°C';
    const labelsize = textWidth(labeltext);
    const labelpos = -r;         // y direction still screen-like, otherwise text would be upside down
    // Circle
    stroke(c);
    strokeWeight(4 * pixelsize);
    noFill();
    circle(0, 0, r * 2);
    // Label on background
    noStroke();
    fill(bgcolour); // erase for label
    rect(0, labelpos, labelsize + 8 * pixelsize, textheight1 + 2 * pixelsize); // plus a few pixels margin for legibility
    fill(c);
    text(labeltext, 0, labelpos + 7 * pixelsize); // +7px correction for textAlign(..,CENTER) not working!
}

// Only show ticks if axes also shown
function axeschanged() {
    if (!chkAxes.checked() && chkTicks.checked())
        chkTicks.checked(false);
}

// If ticks shown then also show axes
function tickschanged() {
    if (chkTicks.checked() && !chkAxes.checked())
        chkAxes.checked(true);
}

// Axis scaling = lin/sqrt/log
function scalingchanged() {
    switch (scaling.value()) {
        case '1': func = rlin; break;
        case '2': func = rsqr; break;
        case '3': func = rlog; break;
    }
}

// Load CSV data of monthly global mean temperature anomalies
// File downloaded from https://data.giss.nasa.gov/gistemp/
//   "Global-mean monthly, seasonal, and annual means, 1880-present"
// Hand-edited to remove title on first line, now starts with header row
function preload() {
    data = loadTable("global-temp-anomaly.csv", "csv", "header");
}

function setup() {
    labels = data.columns.slice(1, label_n + 1); // month names are in header row, columns 1-12
    const rows = data.getRowCount();
    maxindex = label_n * rows - 1; // max index is 1 fewer than count = 12 columns * number of rows
    for (let i = label_n - 1; i >= 0; --i) {
        // check data on last row, from last column backwards
        const s = data.getString(rows - 1, labels[i]);
        if (s === invalid) // data not available yet?
            --maxindex;    // then 1 fewer data point
        else
            break;         // stop checking on first valid data
    }
    dir = new Array(label_n); // 12 direction vectors
    for (let i = 0; i < label_n; ++i) {
        // start at centre-top (for 12 labels and screen-like y direction)
        // increase angle (=clockwise) by same amount as between month labels
        const a = (i - 3) * label_a;
        dir[i] = {x: Math.cos(a), y: Math.sin(a)};
    }
    createCanvas(canvassize, canvassize);
    colorMode(RGB);
    cool    = color(  0,   0, 255); // blue  for temperature anomaly < 0
    neutral = color(255, 255, 255); // white for temperature anomaly = 0
    warm    = color(255,   0,   0); // red   for temperature anomaly > 0
    rectMode(CENTER);
    textAlign(CENTER, CENTER); // vertical align CENTER doesn't seem to be working; it's same as BASELINE
    chkGrid = createCheckbox('grid', true);
    chkAxes = createCheckbox('axes', false);
    chkTicks = createCheckbox('ticks', false);
    chkAxes.changed(axeschanged);
    chkTicks.changed(tickschanged);
    scaling = createRadio();
    scaling.option('1', 'linear');
    scaling.option('2', 'sqrt');
    scaling.option('3', 'log');
    scaling.selected('1');
    scaling.changed(scalingchanged); // avoid expensive check in draw() loop
}

function draw() {
    // Erase canvas, set origin/scale
    background(bgcolour);
    translate(origin, origin);
    scale(scalefactor);

    // Grid and axes
    if (chkGrid.checked())
        showgrid(0.5);
    if (chkAxes.checked())
        showaxes(chkTicks.checked() ? 0.25 : 0);

    // Reference circles
    for (let i = 0; i < refs.length; ++i)
        refcircle(refs[i]);

    // Month labels, directly behind refcircles to reuse settings
    fill(labelcolour);
    // textSize(textheight1); // same as labels on refcircles, no need to set again here
    // noStroke();
    for (let i = 0; i < label_n; ++i) {
        text(labels[i], 0, label_r); // centre-top for current rotation
        rotate(label_a); // circle divided by 12 months = 30 degrees
    } // back at normal rotation

    // Year label, directly behind month labels to reuse settings
    textSize(textheight2);
    // noStroke(); // same as month labels, no need to set again here
    // fill(labelcolour);
    text(data.getString(Math.floor(index / labels.length), 0), 0, 16 * pixelsize);

    // Lines from point to point
    strokeWeight(2 * pixelsize);
    noFill();
    let t0 = data.getNum(0, labels[0]); // first temperature anomaly in the set (Jan 1880)
    const r0 = func(t0); // circle radius
    let x0 = r0 * dir[0].x;
    let y0 = r0 * dir[0].y;
    let yr = 0, mn = 1; // year/month in the loop (month starts at 1)
    for (let i = 1; i <= index; ++i) {         // fast & simple loop up to & including index = maxindex
        const t = data.getNum(yr, labels[mn]); // these are all valid as checked in setup()
        const r = func(t);
        const x = r * dir[mn].x;
        const y = r * dir[mn].y;
        stroke(gradient((t0 + t) / 2));
        line(x0, y0, x, y);
        // Remember for next loop
        t0 = t;
        x0 = x;
        y0 = y;
        // Next month/year
        if (++mn == label_n) {
            mn = 0;
            ++yr;
        }
    }

    // Next animation step
    if (index < maxindex)
        ++index;
}