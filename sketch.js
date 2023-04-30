// Data properties
const anomin   = -1.0;        // anomaly value at the origin (must be < 0)
const anomax   =  1.5;        // anomaly value at the edge (must be > 0)
const refs     = [0, 1, 1.5]; // reference circles
const invalid  = '***';       // placeholder for unavailable data in the CSV file

// Visualisation parameters
const canvassize  = 800; // canvas width and height in pixels
const bgcolour    =   0; // black
const gridcolour  = 102; // grey
const axescolour  = 153; // light grey
const labelcolour = 255; // white
const margin   = 0.12;   // leave 12% margin around the plot for month labels
const gridstep = 0.50;   // gridline every 0.5 degrees celsius
const tickmult = 4;      // number of ticks per grid division (4 means: 3 ticks between gridlines)
const ticksize = 0.03;   // size of ticks on axes in scaled coordinates
let cool, neutral, warm; // temperature anomaly colours defined in setup()

// Derived constants for internal use
const range       = anomax - anomin;                // axes go from -range to +range in scaled coordinates
const origin      = canvassize / 2;                 // origin centered on the canvas
const plotscale   = origin / range / (1 + margin);  // symmetric plot grid [-range..+range] with 12% margin
const textheight1 = 20 * canvassize / 800;          // 20px in scaled coordinates (for canvassize=800)
const textheight2 = 50 * canvassize / 800;          // 50px in scaled coordinates (for canvassize=800)
const label_n   = 12;                               // number of labels = 12 months in a year
const label_a   = -2 * Math.PI / label_n;           // label angle = month labels 30 degrees apart (negative = clockwise in scaled coordinates)
const label_r   = origin / (1 + margin / 2);        // label radius = month labels in middle of margin, start at centre-top (label_v inverts y)
const rangelog  = (Math.exp(range) - 1) / range;    // range scaling for logarithmic graph

// Variables
let mapping = 0;    // axes scaling as index: 0 = linear, 1 = sqrt, 2 = log
let running = true; // draw loop always runs to enable interaction, this controls the animation
let index = 0;      // animation progression
let data, datalen;  // data from CSV file, number of data points on file
let labels, year0;  // labels = month names from CSV header row, year0 = year on row 0
let label_v;        // direction vectors corresponding to labels (=month names), y inverted from screen-like to maths
let points;         // pre-calculated points and colours
let circles;        // pre-calculated refcircle parameters
let chkGrid, chkAxes, chkTicks, scaling, timeindex; // checkboxes, radiobuttons, slider

// Linear translation from degrees celsius to circle radius in pixels
function radius_lin(celsius) {
    const dist = celsius - anomin;
    return dist > 0 ? dist * plotscale : 0; // linear map [min..max] => [0..range] * 400
}

// Quadratic translation from degrees celsius to circle radius in pixels
function radius_sqrt(celsius) {
    const dist = celsius - anomin;
    return dist > 0 ? Math.sqrt(dist * range) * plotscale : 0; // sqrt map [min..max] => [0..range] * 400
}

// Logarithmic translation from degrees celsius to circle radius in pixels
function radius_log(celsius) {
    const dist = celsius - anomin;
    return dist > 0 ? Math.log(1 + dist * rangelog) * plotscale : 0; // log map [min..max] => [0..range] * 400
}

// Show grid
function showgrid() {
    stroke(gridcolour);
    strokeWeight(0.5);
    noFill();
    // Gridlines on the axes
    line(0, -origin, 0, origin);
    line(-origin, 0, origin, 0);
    // Other gridlines
    for (const r of grid_r) {
        line(r, -origin, r, origin);
        line(-r, -origin, -r, origin);
        line(-origin, r, origin, r);
        line(-origin, -r, origin, -r);
    }
}

// Show axes and ticks
function showaxes(showticks) {
    stroke(axescolour);
    strokeWeight(1);
    noFill();
    // Axes
    line(0, -origin, 0, origin);
    line(-origin, 0, origin, 0);
    // Ticks
    if (showticks)
        for (const r of tick_r) {
            line(r, -ticksize, r, ticksize);
            line(-r, -ticksize, -r, ticksize);
            line(-ticksize, r, ticksize, r);
            line(-ticksize, -r, ticksize, -r);
        }
}

// Colour gradient depends on temperature anomaly in degrees celsius
function gradient(celsius) {
    if (celsius >= 0)
        return lerpColor(neutral, warm, celsius / anomax); // anomylymax > 0
    return lerpColor(neutral, cool, celsius / anomin);     // anomalymin < 0
}

// If axes not shown then also disable ticks
function axeschanged() {
    if (!this.checked() && chkTicks.checked())
        chkTicks.checked(false);
}

// If ticks enabled then also show axes
function tickschanged() {
    if (this.checked() && !chkAxes.checked())
        chkAxes.checked(true);
}

// Axis scaling: 0=lin, 1=sqrt, 2=log
function scalingchanged() {
    mapping = parseInt(this.value()) - 1;
}

// Stop animation when slider manually adjusted
function slidermove() {
    running = false;
}

// Toggle animation when canvas clicked, or else propagate click
function mouseClicked() {
    if (mouseX >= 0 && mouseY >= 0 && mouseX < canvassize && mouseY < canvassize) {
        running = !running;
        return false;
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
    labels = data.columns.slice(1, label_n + 1); // month names are in header row, columns 1..12
    year0 = data.getNum(0, 0); // row 0 col 0 = first year, should be 1880

    // Determine total number of data points in the CSV file
    // Last row may be incomplete, check from last column backwards
    const datarows = data.getRowCount();
    datalen = label_n * datarows; // length = 12 columns * number of rows
    for (let i = label_n; i > 0; --i) { // column index 12..1
        if (data.getString(datarows - 1, i) !== invalid)
            break; // stop checking on first valid data
        --datalen; // or else 1 fewer data point
    }

    // Pre-calculate 12 unit-length direction vectors
    // start at centre-top and go clockwise (for 12 labels and screen-like y-direction)
    label_v = new Array(label_n);
    for (let i = 0; i < label_n; ++i) {
        const a = (i - 3) * label_a;
        label_v[i] = {x: Math.cos(a), y: Math.sin(a)};
    }

    // Precalculate refcircle parameters
    circles = [];
    textSize(textheight1); // must be set before call to textWidth()
    for (const c of refs) { // c = refcircle value in degrees celsius
        const txt = nf(c, 1, 1) + '°C';
        circles.push({
            txt: txt,
            w: textWidth(txt) + 8,
            h: textheight1 + 2,
            gr: gradient(c),
            px: [radius_lin(c), radius_sqrt(c), radius_log(c)]
        });
    }

    // Precalculate grid and tick coordinates
    grid_r = []; // gridlines on the axes are implied
    for (let i = 1; i <= Math.round(range / gridstep); ++i) {
        const c = anomin + i * gridstep;
        grid_r.push([radius_lin(c), radius_sqrt(c), radius_log(c)]);
    }
    // const tickstep  = gridstep / 4;                     // 3 ticks between gridlines
    // const tickcount = Math.round(range / tickstep) + 3; // how many ticks from anomin to anomax, +3 outside last gridline

    // Pre-calculate all line colours and screen x/y coordinates
    // (direct pixel coordinates for translated origin)
    points = new Array(datalen);
    let ix = 0, t0 = 0;
    for (let row = 0; row < datarows; ++row) // all rows
        for (let mn = 0; mn < label_n; ++mn) // all months
            if (ix < datalen) {
                const t = data.getNum(row, mn + 1); // months in col 1-12
                const r = [radius_lin(t), radius_sqrt(t), radius_log(t)]; // radius in pixels
                points[ix++] = {
                    yr: row + year0,
                    gr: gradient((t0 + t) / 2),
                    px: [
                        {x: r[0] * label_v[mn].x, y: r[0] * label_v[mn].y},
                        {x: r[1] * label_v[mn].x, y: r[1] * label_v[mn].y},
                        {x: r[2] * label_v[mn].x, y: r[2] * label_v[mn].y}
                    ]
                };
                t0 = t;
            }

    createCanvas(canvassize, canvassize);
    colorMode(RGB);
    cool    = color(  0,   0, 255); // blue  for temperature anomaly < 0
    neutral = color(255, 255, 255); // white for temperature anomaly = 0
    warm    = color(255,   0,   0); // red   for temperature anomaly > 0
    rectMode(CENTER);
    textAlign(CENTER, CENTER);

    timeindex = createSlider(0, datalen - 1);
    timeindex.style('width', `${canvassize}px`);
    chkGrid = createCheckbox('grid', true);
    chkAxes = createCheckbox('axes', false);
    chkTicks = createCheckbox('ticks', false);
    scaling = createRadio();
    scaling.option('1', 'linear');
    scaling.option('2', 'sqrt');
    scaling.option('3', 'log');
    scaling.selected('1');

    timeindex.mousePressed(slidermove); // stop animation if adjusted manually
    chkAxes.changed(axeschanged);
    chkTicks.changed(tickschanged);
    scaling.changed(scalingchanged); // avoid expensive check in draw() loop
}

function draw() {
    // Erase canvas, set origin/scale
    background(bgcolour);
    translate(origin, origin);

    // Show progress or jump to time index
    if (running)
        timeindex.value(index);
    else
        index = timeindex.value();

    // Grid and axes
    if (chkGrid.checked())
        showgrid();
    if (chkAxes.checked())
        showaxes(chkTicks.checked());

    // Reference circles
    textSize(textheight1);
    strokeWeight(4);
    for (const c of circles) {
        const r = c.px[mapping];
        stroke(c.gr);
        noFill();
        circle(0, 0, r * 2);
        noStroke();
        fill(bgcolour); // erase space for label
        rect(0, -r, c.w, c.h);
        fill(c.gr);
        text(c.txt, 0, -r);
    }

    // Month labels, directly after refcircle() to reuse settings
    fill(labelcolour);
    // textSize(textheight1); // same as labels on refcircles, no need to set again here
    // noStroke();
    for (const label of labels) {
        text(label, 0, label_r); // centre-top for current rotation
        rotate(label_a); // circle divided by 12 months = 30 degrees
    } // now back at normal rotation

    // Year label, directly behind month labels to reuse settings
    textSize(textheight2);
    // noStroke(); // same as month labels, no need to set again here
    // fill(labelcolour);
    text(points[index].yr, 0, 0);

    // Lines from point to point
    strokeWeight(2);
    noFill();
    let p = points[0].px[mapping];
    for (let i = 1; i <= index; ++i) { // fast & simple loop up to & including index < datalen
        stroke(points[i].gr);
        const q = points[i].px[mapping];
        line(p.x, p.y, q.x, q.y);
        p = q;
    }

    // Next animation step
    if (running) {
        if (index < datalen)
            ++index;
        else
            running = false;
    }
}