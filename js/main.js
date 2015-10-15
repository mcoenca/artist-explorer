/* global SpotifyWebApi, dndTree, $, geoplugin_countryCode, Promise, google, setRepeatArtists, document, ko */
(function () {
    "use strict";

    var numberOfContentsToShow = 10;

    // var showCompletion = true;
    var repeatArtists = false;

    //default to US
    // var userCountry = "US";

    //replace with configured servers uri
    var serverBasePath = "http://localhost:3000";
    var initialNodeId = "fTDWNqroGMppqNzQq";

    var localApi = new localProxyApi(serverBasePath);

    var currentApi = localApi;

    var loadAllGenresUri = serverBasePath + "/api/genres"
    var loadArtistInfoUri = serverBasePath + "/api/artist-info/"

    // utilities stuff for resizing and getting UI not bound
    function getGenreArtistsUri(genreId) {
        return serverBasePath + "/api/genres/" + genreId + "/artists";
    }

    window.onresize = function () {
        dndTree.resizeOverlay();
        var height = $(window).height();
        $("#rightpane").height(height);
    };

    $("#rightpane").height($(window).height());


    function setRepeatArtists() {
        if (document.getElementById("repeatArtists").checked) {
            repeatArtists = true;
        } else {
            repeatArtists = false;
        }
    }

    function isZoomable() {
        if (document.getElementById("isZoomable").checked) {
            return true;
        } else {
            return false;
        }
    }
    //String modif utilities
    //whatdahell seems to be fetching something the url
    //must be related to weird ways of sharing this
    function qs(name) {
        console.log("QS: ", name);
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        console.log(results, results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " ")));
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    function stripTrailingSlash(str) {
        if (str.substr(-1) == "/") {
            return str.substr(0, str.length - 1);
        }
        return str;
    }

    function toTitleCase(str) {
        return str ? str.replace(/\w\S*/g, function (txt) {return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); }) : "";
    }

    //get id from some way, or id of sharing
    //or DEFAULT ID
    function initContainer() {
        console.log("initContainer");
        var initArtistId = stripTrailingSlash(qs("artist_id")),
            initGenre = stripTrailingSlash(qs("genre")),
            initEntry = stripTrailingSlash(qs("tree"));

        if (initEntry) {
            $.ajax({
                url: serverBasePath + "/api/entries/" + initEntry
            }).done(function (data) {
                initRootWithData(JSON.parse(data));
            });
        }
        else if (initArtistId) {
            currentApi.getArtist(initArtistId).then(initRootWithArtist);
        } else if (initGenre) {
            initRootWithGenre(initGenre);
        } else {
            //Fallback on elvis presley
            currentApi.getArtist(initialNodeId).then(initRootWithArtist);
        }
    }

    //Function to initiate the dnd tree
    //artist object ?
    function initRootWithArtist(artist) {
        dndTree.setRoot(artist);
        $("#genre-search").val("");
        dndTree.resizeOverlay();
    }

    function initRootWithGenre(genre) {
        dndTree.setRootGenre(genre);
        $("#artist-search").val("");
    }

    function initRootWithData(data) {
        dndTree.setRootData(data);
        $("#artist-search").val("");
        $("#genre-search").val("");
    }

    //On load
    //LOADING TREEEEE
    window.addEventListener("load", function () {

        console.log("page loaded");
        initContainer();

        //Search form behaviour
        /* var formArtist = document.getElementById("search-artist");
        formArtist.addEventListener("submit", function (e) {
            showCompletion = false;
            e.preventDefault();
            var search = document.getElementById("artist-search");
            currentApi.searchArtists(
                search.value.trim(),
                userCountry
                ).then(function (data) {
                if (data.artists && data.artists.items.length) {
                    initRootWithArtist(data.artists.items[0]);
                }
            });

        }, false);


        var formGenre = document.getElementById("search-genre");
        formGenre.addEventListener("submit", function (e) {
            showCompletion = false;
            e.preventDefault();
            var search = document.getElementById("genre-search");
            var genreName = search.value.trim();
            initRootWithGenre(genreName);
        }, false); */
    }, false);


    var allGenres = [];
    function loadAllGenres() {
        $.ajax({
            url: loadAllGenresUri
        }).done(function (data) {
            data.genres.forEach(function (genre) {
                allGenres.push(toTitleCase(genre.name));
            });
        });
    }
    loadAllGenres();

    //AE.getInfo functionality
    //creates contentInfoModel from artist object
    //and other calls
    //draws the chart
    //calls the api artistInfoUri to get bio and bioExists
    //genres
    //artist top tracks and plays the first one
    function _getInfo(content) {
        $("#hoverwarning").css("display", "none");

        contentInfoModel.isArtistInfoVisible(true);
        contentInfoModel.artistName(content.name);
        contentInfoModel.spotifyLink(content.external_urls.spotify);
        contentInfoModel.image(getSuitableImage(content.images));

        if(content.previousContent) {
            contentInfoModel.previousContent(
            content.previousContent);
            contentInfoModel.previousContentImageUrl(
            content.previousContentImageUrl);
        }

        $.ajax({
            url: loadArtistInfoUri + content.uri
        }).done(function (data) {
            var bioFound = false;
            if (data.artist.biographies) {
                data.artist.biographies.forEach(function (biography) {
                    if (!biography.truncated && !bioFound) {
                        contentInfoModel.biography(biography.text);
                        bioFound = true;
                    }
                });
            }
            contentInfoModel.bioExists(bioFound);

            dndTree.highlightPathAndNode(content);

            contentInfoModel.genres([]);
            data.artist.genres.forEach(function (genre) {
                contentInfoModel.genres.push(
                    {
                        "name": genre.name,
                        "titleCaseName": toTitleCase(genre.name)
                    }
                );
            });
        });
    }
    var getInfoTimeoutid;
    //wrapper around _getinfo with settimeout
    function getInfo(artist) {
        getInfoTimeoutid = window.setTimeout(function () {
            _getInfo(artist);
            $("#rightpane").animate({ scrollTop: "0px" });
        }, 500);
    }

    function getInfoCancel(artist) {
        window.clearTimeout(getInfoTimeoutid);
    }

    //The artist UI model display, bound to DOM panel on the right
    // artistName and other observables
    // playTrack (methods bounds to other parts)
    // swithToGenre
    var contentInfoModel = function() {
        var self = this;

        //old naming
        self.artistName = ko.observable();
        self.isArtistInfoVisible = ko.observable(false);
        self.spotifyLink = ko.observable();
        // self.popularity = ko.observable();
        // old stuff
        self.biography = ko.observable();
        self.bioExists = ko.observable();
        //not working
        self.genres = ko.observableArray([]);

        //new things
        self.image = ko.observable();
        self.previousContent = ko.observable({});
        self.previousContentImageUrl = ko.observable("");


        // self.switchToGenre = function() {
        //     initRootWithGenre(this.name);
        // };
    };
    var contentInfoModel = new contentInfoModel();
    ko.applyBindings(contentInfoModel, document.getElementById("rightpane"));

    //gets the next Contents from the first one
    //with a promise on getArtistRelatedArtists (artistId)
    //data.artists = [artists]
    function getRelated(contentId, excludeList) {
        return new Promise(function (resolve, reject) {
            return currentApi.getArtistRelatedArtists(contentId).then(function (data) {

                data.artists.sort(function (a, b) {
                    return b.popularity - a.popularity;
                });
                if (!repeatArtists) {
                    data.artists = data.artists.filter(function (artist) {
                        return excludeList.indexOf(artist.id) === -1;
                    });
                }

                resolve(data.artists.slice(0, numberOfContentsToShow));
            });
        });
    }

    function getIdFromArtistUri(artistUri) {
        return artistUri.split(":").pop();
    }

    //Gets from a genreName an array of artists
    //goes to en first with genre name to retrieve spotify ids (???)
    //and then goes to spotify
    // function getArtistsForGenre(genreName) {
    //     return new Promise(function (resolve, reject) {
    //         return $.ajax({
    //             url: getGenreArtistsUri(encodeURIComponent(genreName.toLowerCase()))
    //         }).then(function (data) {
    //             var idsToRequest = [];
    //             data.artists.forEach(function (artist) {
    //                 if (artist.foreign_ids) {
    //                     idsToRequest.push(getIdFromArtistUri(artist.foreign_ids[0].foreign_id));
    //                 }
    //             });
    //             return currentApi.getArtists(idsToRequest).then(function (data) {
    //                 //Sort in popularity order
    //                 resolve(data.artists.sort(function (a, b) {
    //                     return b.popularity - a.popularity;
    //                 }).slice(0, numberOfContentsToShow));
    //             });
    //         });
    //     });
    // }

    function changeNumberOfContents(value) {
        numberOfContentsToShow = value;
        document.getElementById("range-indicator").innerHTML = value;
    }

    //utility function to extract best images from the content images field
    function getSuitableImage(images) {
        var minSize = 64;
        if (images.length === 0) {
            return "img/spotify.jpeg";
        }
        images.forEach(function (image) {
            if (image && image.width > minSize && image.width > 64) {
                return image.url;
            }
        });

        return images[images.length - 1].url;
    }

    //autocomplete div from search bar
    //uses artist.name and artist.images
    function createAutoCompleteDiv(artist) {
        if (!artist) {
            return;
        }
        var val = "<div class='autocomplete-item'>" +
            "<div class='artist-icon-container'>" +
            "<img src=" + getSuitableImage(artist.images) + " class='circular artist-icon' />" +
            "<div class='artist-label'>" + artist.name + "</div>" +
            "</div>" +
            "</div>";
        return val;
    }

    //only the DOM is loaded not the content
    //loading the autocomplete
    //with jquery plugin searchArtistsApi
    //add * to the search term, ang gives a limit and market param
    //data.artists & data.artists.items => items are the true objects
    // genre search autocomplete
    // goes in allGenres fetched before, and init with ui.item.value
    // and not only ui.item like in artist
    $(function () {
        console.log("Jquery loaded");

        $("#closeIframe").on("click", function() {
            iframeModel.iframeHTML("");
        });
        /*
        $("#artist-search")
            // don"t navigate away from the field on tab when selecting an item
            .bind("keydown", function (event) {
                showCompletion = true;
                if (event.keyCode === $.ui.keyCode.TAB &&
                    $(this).autocomplete("instance").menu.active) {
                    event.preventDefault();
                }
            })
            .autocomplete({
                minLength: 0,
                source: function (request, response) {
                    currentApi.searchArtists(request.term + "*", {"limit": 50, market: userCountry}).then(function (data) {
                        if (data.artists && data.artists.items.length) {
                            var res = [];
                            data.artists.items.forEach(function (artist) {
                                res.push(artist);
                            });
                            if (showCompletion) {
                                response(res);
                            } else {
                                response([]);
                            }
                        }
                    }, function (err) {
                        if (err.status == 400) {
                            setUnavailCountryErrorMessage();
                            return;
                        }
                    });
                },
                focus: function () {
                    // prevent value inserted on focus
                    return false;
                },
                select: function (event, ui) {
                    $("#artist-search").val(ui.item.name);
                    initRootWithArtist(ui.item);
                    return false;
                }
            })
            .autocomplete("instance")._renderItem = function (ul, item) {
                if (!item) {
                    console.log("no item");
                    return;
                }
                return $("<li></li>")
                    .data("item.autocomplete", item)
                    .append(createAutoCompleteDiv(item))
                    .appendTo(ul);
            };

        $("#genre-search")
            // don"t navigate away from the field on tab when selecting an item
            .bind("keydown", function (event) {
                showCompletion = true;
                if (event.keyCode === $.ui.keyCode.TAB &&
                    $(this).autocomplete("instance").menu.active) {
                    event.preventDefault();
                }
                if (event.keyCode == 13) {
                    $(".ui-menu-item").hide();
                }
            })
            .autocomplete({
                minLength: 0,
                source: function (request, response) {
                    if (showCompletion) {
                        response($.ui.autocomplete.filter(allGenres, request.term));
                    } else {
                        response([]);
                    }
                },
                focus: function (e, ui) {
                    // prevent value inserted on focus
                    return false;
                },
                select: function (event, ui) {
                    $("#genre-search").val(ui.item.value);
                    initRootWithGenre(ui.item.value);
                    return false;
                }
            });
        */
    });

    function showIframe(content) {
        var author = content.bridgeAuthor;
        iframeModel.iframeHTML(content.iframeHTML);
        iframeModel.authorAvatar(content.authorAvatar);
        iframeModel.authorUsername(author.username);
        $("#iframeModal").modal("show");
    }
    var IframeModel = function() {
        var self = this;
        self.iframeHTML = ko.observable();
        self.authorAvatar = ko.observable();
        self.authorUsername = ko.observable();
    };
    var iframeModel = new IframeModel();
    ko.applyBindings(iframeModel, document.getElementById("iframeModal"));


    //Login UI Model for KO, accessToken and localStorage for ae_userid, ae_display_name ae_user_image etc...

    //Error UI Model for KO
    var errorBoxModel = function() {
        var self = this;
        self.errorMessage = ko.observable();
    }
    var errorBoxModel = new errorBoxModel();
    ko.applyBindings(errorBoxModel, document.getElementById("error-modal"));

    window.AE = {
        getSuitableImage: getSuitableImage,
        getRelated: getRelated,
        getInfoCancel: getInfoCancel,
        getInfo: getInfo,
        changeNumberOfArtists: changeNumberOfContents,
        setRepeatArtists: setRepeatArtists,
        toTitleCase: toTitleCase,
        contentInfoModel: contentInfoModel,
        showIframe: showIframe,
        isZoomable: isZoomable
    };
})();
