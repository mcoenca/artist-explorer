/*global d3*/
var dndTree = (function() {
    'use strict';

    var svgGroup;

    // Misc. variables
    var i = 0;
    var duration = 750;
    var root;

    //This var messes up with the interface sizing
    var rightPaneWidth = 350;
    var navbarHeight = 54;

    //History Vars
    var exploredArtistIds = [];
    var lastExpandedNode;
    var nodesExpandedHistory = [];

    // avoid clippath issue by assigning each image its own clippath
    var clipPathId = 0;

    // size of the diagram
    var viewerWidth = window.innerWidth - rightPaneWidth;
    var viewerHeight = window.innerHeight - navbarHeight;


    //d3 objects
    var tree = d3.layout.tree()
        .size([viewerHeight, viewerWidth]);

    var diagonal = d3.svg.diagonal()
        .projection(function(d) {
            return [d.y, d.x];
        });

    // Define the zoom function for the zoomable tree

    function zoom() {
        if (AE.isZoomable()) {
            svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }
    }

    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

    // define the baseSvg, attaching a class for styling and the zoomListener
    var baseSvg = d3.select("#tree-container").append("svg")
        .attr("width", viewerWidth)
        .attr("height", viewerHeight)
        .attr("class", "overlay")
        .call(zoomListener);

    function updateWindow() {
        var pixelWide = $('#rightpane').css('width');
        var pixelHeight = $('#navbarup').css('height');

        rightPaneWidth = parseInt(
            pixelWide.substr(0, pixelWide.length - 2));
        navbarHeight = parseInt(pixelHeight.substr(0, pixelHeight.length -2));
        viewerWidth = $(window).width() - rightPaneWidth;
        viewerHeight = $(window).height();
        baseSvg.attr("width", viewerWidth).attr("height", viewerHeight);
        if (lastExpandedNode) {
            centerNode(lastExpandedNode);
        }
    }

    // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.
    // Looks really weird
    function centerNode(source) {
        lastExpandedNode = source;
        var scale = zoomListener.scale();
        //WATCH OUT EVERYTHING WAS BADLY DONE OBJECTS
        //HAVE INVERTED X AND Y
        var x = -source.y0;
        var y = -source.x0;

        var nodeHeightOffset = 32;

        //to center it:
        x = x * scale;
        y = (y + viewerHeight / (2 * scale) - nodeHeightOffset) * scale;

        zoomListener.scale(scale);
        zoomListener.translate([x, y]);

        //Make everything translate
        if (!AE.isZoomable()) {
            d3.select("#tree-container g").transition()
                .duration(duration)
                .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
            } else {//make the zoom transition to the new place
                zoomListener.event(
                    d3.select("#tree-container g").transition().duration(500)
                );
            }
    }
    //This is called when we click on an artist and its update the model of the tree
    function setChildrenAndUpdateForArtist(node) {
        var artists;
        //TODO: Add previous node info here
        AE.getRelated(node.artist.id, exploredArtistIds).then(function(artists) {
            if (!node.children) {
                node.children = []
            }

            artists.forEach(function(artist) {

                node.children.push({
                    'artist': artist,
                    'children': null
                })
                exploredArtistIds.push(artist.id);

            });
            update(node);
            centerNode(node);
        });
    }

    function setChildrenAndUpdateForGenre(node) {
        var artists;
        AE.getArtistsForGenre(node.genre.name).then(function(artists) {
            if (!node.children) {
                node.children = []
            }

            artists.forEach(function(artist) {
                node.children.push({
                    'artist': artist,
                    'children': null
                })
                exploredArtistIds.push(artist.id);
            });
            update(node);
            centerNode(node);
        });
    }

    function initWithArtist(artist) {
        exploredArtistIds.push(artist.id);
        return {
            'artist': artist,
            'children': null,
        }
    };

    function initWithGenre(genreName) {
        return {
            'genre': {
                'name': genreName
            },
            'children': null,
        }
    };

    function isArtist(d) {
        return 'artist' in d;
    }

    function isGenre(d) {
        return 'genre' in d;
    }

    var highlightedPathAndNodeId;

    function highlightPathAndNode(d) {
        //remove old styling
        svgGroup.select("#pathId" + highlightedPathAndNodeId)
            .style("fill", "none")
            .style("stroke", "#ccc");
        svgGroup.selectAll("g.node")
            .filter(function(data) {
                return data.artist.id === highlightedPathAndNodeId;
            })
            .select("circle")
            .style("stroke", "black")
            .style("stroke-width", "2px");

        //puts the new one
        svgGroup.select("#pathId" + d.artist.id)
            .style("fill", "orange")
            .style("stroke", "orange");
        svgGroup.selectAll("g.node")
            .filter(function(data) {
                return data.artist.id === d.artist.id;
            })
            .select("circle")
            .style("stroke", "orange")
            .style("stroke-width", "6px");

        highlightedPathAndNodeId = d.artist.id;
    }

    function pushNodeInHistory(d) {
        nodesExpandedHistory.push(d);
        AE.refreshHistory();
    }

    function popNodeFromHistory(id) {
        var selectedNode = nodesExpandedHistory[id];
        nodesExpandedHistory.splice(id + 1,
            nodesExpandedHistory.length);
        return selectedNode;
    }

    //recursive function to remove children ids from explored
    function removeExpandedId(d) {
        if (d.children) {
            d.children.forEach(function(node) {
                removeExpandedId(node);
            });
        }
        var indexToRem = exploredArtistIds.indexOf(d.artist.id);
        exploredArtistIds.splice(indexToRem, 1);
    }

    function removeChildrenFromExplored(d) { //something related to duplication of nodes ?
        d.children.forEach(function(node) {
            removeExpandedId(node);
        });
    }


    // Toggle children function
    function toggleChildren(d) {
        if (d.children) {
            //remove the children from the tree
            removeChildrenFromExplored(d);
            d.children = null;
            update(d);
            centerNode(d);
        } else {
            if (isArtist(d)) {
                setChildrenAndUpdateForArtist(d);
            } else if (isGenre(d)) {
                setChildrenAndUpdateForGenre(d);
            }
        }
        return d;
    }

    function loadIframe(d) {
        AE.showIframe(d.artist);
    }

    //event on clicking a node
    function click(d) {
        loadIframe(d);
        d = toggleChildren(d);
        highlightPathAndNode(d);
        pushNodeInHistory(d);
    }
    //Calculates all the stuff related to nodes placement
    //And node insertion + their hover
    //and d3 js transitions does the smooth thing
    //acts only the node given and goes only in one way
    //artist: Object
    // what is a node ???
    // artist: Object ()...
    // depth: 1
    // id: 8
    // parent: Object
    // x: 375
    // x0: 375
    // y: 220
    // y0: 220
    function update(source) {
        var levelWidth = [1];
        var childCount = function(level, n) {
            //recursively counts the number of children and changes levelWidth to have the total number of nodes at each layer
            //from root
            //[1, 10, 6]
            // console.log(n);
            if (n.children && n.children.length > 0) {
                if (levelWidth.length <= level + 1) levelWidth.push(0);

                levelWidth[level + 1] += n.children.length;
                n.children.forEach(function(c) {
                    childCount(level + 1, c);
                });
            }
        };
        // console.log(levelWidth);
        childCount(0, root);
        // console.log(levelWidth);
        // update levelWidth to contain all the population of the tree
        var newHeight = d3.max(levelWidth) * 100;
        //update height of tree
        tree = tree.size([newHeight, viewerWidth]);

        // Compute the new tree layout.
        var nodes = tree.nodes(root).reverse();
        var links = tree.links(nodes);
        //link: {source:{
        //artist,
        //depth (in the tree),
        //id,
        //parent,
        //x,x0,y,y0
        //}, target}
        // console.log(nodes);
        // console.log(links);

        // Set widths between levels
        // This is the left to right thing
        nodes.forEach(function(n) {
            n.y = (n.depth * 220);
        });
        // Update the nodes…
        var node = svgGroup.selectAll("g.node")
            //!!!! Bind the nodes data from tree object, based on id
            // to the SVG stuff
            .data(nodes, function(d) {
                // console.log(d.id);
                return d.id || (d.id = ++i);
            });

        // Enter any new nodes at the parent's previous position.
        // node.enter will make the new nodes enter the tree,
        // append g will make them new elements
        var nodeEnter = node.enter().append("g")
            // .call(dragListener)
            .attr("class", "node")
            //put a transform at the origin first
            .attr("transform", function(d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .on("mouseover", function(d) {
                if ('artist' in d) {
                    AE.getInfo(d.artist);
                }
                //add a clipPath modify
                // highlightPathAndNode(d);
            })
            .on("mouseout", function(d) {
                if ('artist' in d) {
                    AE.getInfoCancel();
                }
            })
            .on('click', click);

        nodeEnter.append("circle")
            .attr("r", 32)
            .style("fill", function(d) {
                return d._children ? "black" : "#fff";
            });

        //ClipPath Stuff, unique id for each
        //this is to make the image round
        clipPathId++;

        nodeEnter.append("clipPath")
            .attr("id", "clipCircle" + clipPathId)
            .append("circle")
            .attr("r", 32);


        nodeEnter.append("image")
            .attr("xlink:href", function(d) {
                if (isArtist(d)) {
                    return AE.getSuitableImage(d.artist.images);
                } else {
                    return 'img/spotify.jpeg';
                }
            })
            .attr("x", "-32px")
            .attr("y", "-32px")
            .attr("clip-path", "url(#clipCircle" + clipPathId + ")")
            .attr("width",
                function(d) {
                    if (isArtist(d)) {
                        var image = d.artist.images[1];
                        if (!image) {
                            return 64;
                        }
                        if (image.width > image.height) {
                            return 64 * (image.width / image.height)
                        } else {
                            return 64;
                        }
                    } else {
                        return 64;
                    }
                })
            .attr("height",
                function(d) {
                    if (isArtist(d)) {

                        var image = d.artist.images[1];
                        if (!image) {
                            return 64;
                        }
                        if (image.height > image.width) {
                            return 64 * (image.height / image.width)
                        } else {
                            return 64;
                        }
                    } else {
                        return 64;
                    }
                })

        nodeEnter.append("text")
            .attr("x", function(d) {
                return 40;
            })
            .attr("dy", ".35em")
            .attr('class', 'nodeText')
            .attr("text-anchor", function(d) {
                return "start";
            })
            .text(function(d) {
                if (isArtist(d)) {
                    return d.artist.name;
                } else if (isGenre(d)) {
                    return "Genre:" + AE.toTitleCase(d.genre.name);
                }

            })
            .style("fill-opacity", 0);

        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + d.y + "," + d.x + ")";
            });

        // Fade the text in
        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();

        nodeExit.select("circle")
            .attr("r", 0);

        nodeExit.select("text")
            .style("fill-opacity", 0);

        // Update the links…
        // path class=link
        // separate from nodes
        // bound the data from the tree model
        // all the styling is in fill, stroke, and stroke-width
        var link = svgGroup.selectAll("path.link")
            .data(links, function(d) {
                return d.target.id;
            });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("id", function(d) {
                return "pathId" + d.target.artist.id;
            })
            .attr("d", function(d) {
                var o = {
                    x: source.x0,
                    y: source.y0
                };
                return diagonal({
                    source: o,
                    target: o
                });
            });

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function(d) {
                var o = {
                    x: source.x,
                    y: source.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    svgGroup = baseSvg.append("g");

    function copyTree(from, to) {
        if (from.artist) {
            to.artist = from.artist
        }

        if (from.genre) {
            to.genre = from.genre
        }

        if (!from.children) {
            return;
        }
        to.children = []
        from.children.forEach(function(node) {
            var child = {}
            copyTree(node, child)
            to.children.push(child);
        })
    }

    function serializeTree() {
        var obj = {};
        copyTree(root, obj)
        return obj;
    }

    function initWithData(from, to) {
        if (from.artist) {
            to.artist = from.artist;
            exploredArtistIds.push(to.artist.id);
        }
        if (from.genre) {
            to.genre = from.genre;
        }

        if (from.children) {
            to.children = []
            from.children.forEach(function(child) {
                var obj = {}
                initWithData(child, obj);
                to.children.push(obj);
            })
        }

        if (to.children && to.children.length > 0) {
            //console.log(to.artist.name);
            //update(root);
        }

    }

    function getAllArtists(node, artistIds) {
        if (isArtist(node)) {
            artistIds.push(node.artist.id);
        }
        if (!node.children) {
            return;
        }
        node.children.forEach(function(child) {
            getAllArtists(child, artistIds);
        })
    }

    return {
        "highlightPathAndNode": function(artist) {
            highlightPathAndNode({
                artist: artist
            });
        },
        "setRoot": function(artist) {
            exploredArtistIds = []
            root = initWithArtist(artist);
            root.x0 = viewerHeight / 2;
            root.y0 = 0;
            update(root);
            centerNode(root);
            click(root)
        },

        "getExploredArtistsIds": function() {
            return exploredArtistIds;
        },
        "setRootGenre": function(genreName) {
            exploredArtistIds = []
            root = initWithGenre(genreName);
            root.x0 = viewerHeight / 2;
            root.y0 = 0;
            update(root);
            centerNode(root);
            click(root);
        },

        "getRoot": function() {
            return serializeTree();
        },

        "setRootData": function(rootData) {
            exploredArtistIds = []
            root = {}
            initWithData(rootData, root);
            root.x0 = viewerHeight / 2;
            root.y0 = 0;
            update(root);
            centerNode(root);
        },

        "resizeOverlay": function() {
            updateWindow();
        },

        "getAllArtists": function() {
            var artistIds = [];
            getAllArtists(root, artistIds);
            //Return no more than 50 artists and make sure root is always there
            if (artistIds.length > 50) {
                artistIds = Util.getRandom(artistIds, 50);
                if (isArtist(root)) {
                    if (artistIds.indexOf(root.artist.id) != -1) {
                        artistIds.push(root.artist.id);
                    }
                }

            }
            return artistIds;
        },
        "getZoom": function() {
            return zoomListener;
        },
        "getViewerSize": function() {
            return [viewerWidth, viewerHeight];
        }, 
        "getTree": function() {
            return tree;
        },
        "getHistory": function() {
            return nodesExpandedHistory;
        },
        "goBackToContent": function(nodePlaceInHistory) {
            centerNode(popNodeFromHistory(nodePlaceInHistory));
            AE.refreshHistory();
        }

    };

})();
