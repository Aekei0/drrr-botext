prevRoomInfo = undefined;
roomInfo = undefined;

//var MacroModal = `
//    <div style="color:#FFFFFF" id="myModal" class="modal fade" role="dialog">
//        <div class="modal-dialog">
//        <!-- Modal content-->
//            <div class="modal-content">
//              <div class="modal-header">
//                <button type="button" class="close" data-dismiss="modal">&times;</button>
//                <h4 class="modal-title">Macro Rule Setup</h4>
//              </div>
//              <div class="modal-body">
//                <p>Write You Macro Rule Here</p>
//                <textarea class="rounded-0" rows="12" style="width:100%;color:black;">Macro Rule Here!!</textarea>
//              </div>
//              <div class="modal-footer">
//                <button id="cancel" type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
//                <button id="cancel" type="button" class="btn btn-default" data-dismiss="modal">Save</button>
//              </div>
//            </div>
//        </div>
//    </div>`

function findUser(name, callback, info){
  if(!info) info = roomInfo;
  if(info && info.room)
    for(u of info.room.users){
      if(u.name == name) return callback ? callback(u) : u;
    }
  if(prevRoomInfo && prevRoomInfo.room){
    for(u of prevRoomInfo.room.users){
      if(u.name == name) return callback ? callback(u) : u;
    }
  }
}

function youtube_parser(url){
  if(!url) return false;
  var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  var match = url.match(regExp);
  return (match&&match[7].length==11)? match[7] : false;
}

var handle_talks = function(msg){

  var type = '', user = '',
    text = '', url = '', info = '';
  try{
    //console.log("msg is", msg);
    if(msg.classList.contains("system")){
      if(msg.classList.contains("me")){
        type = event_me;
        user = $(msg).find('.name').text();
        text = $(msg).contents().filter(function() {
          return this.nodeType == 3;
        }).get().pop().textContent;
      }
      else if(msg.classList.contains("music")){
        type = event_music;
        names = $(msg).find('.name');
        user = names[0].textContent;
        text = names[1].textContent;
      }
      else{
        [["leave", event_leave], ["join", event_join], ["new-host", event_newhost]]
          .forEach(([w, e]) => {
            if(msg.classList.contains(w)){
              type = e;
              user = $(msg).find('.name').text();
            }
          });
        if(!type){
          classList = msg.className.split(/\s+/);
          classList.splice(classList.indexOf('talk'), 1);
          classList.splice(classList.indexOf('system'), 1);
          type = classList.length ? classList[0] : 'unknown'
          names = $(msg).find('.name');
          if(names.length){
            user = names[0].textContent;
            if(names.length > 1)
              text = names[1].textContent;
          }
        }
        if(type == event_roomprofile){
          text = $('.room-title-name').text()
        }
        else if(type == event_roomdesc){
          text = $(msg)[0].childNodes[3].textContent
        }
      }
    }
    else{
      text = $(msg).find($('.bubble p'))
        .clone().children().remove().end().text();
      var ue = $(msg).find($('.bubble p a'));
      if(ue.length) url = ue.attr('href');
      ue = $(msg).find($('img'));
      if(ue.length) url = ue.attr('data-src');

      var $user = $(msg).find('.name span');
      if($user.length > 1){ // send dm to someone
        console.log($user);
        user = $user[2].textContent;
        type = event_dmto;
      }
      else{
        user = $(msg).find('.name span').text();
        type = msg.classList.contains("secret") ? event_dm : event_msg;
      }
      if(type == event_dm || type == event_dmto){
        if(user == roomProfile().name) return;
      }
    }
  }
  catch(err){
    alert('err from talks')
    console.log(err);
    throw new Error("Stop execution");
    return;
  }
  console.log(type, user, text, url);

  //if(text.startsWith('/replay')){
  //  console.log(roomInfo);
  //  console.log(roomInfo.room.np);
  //  if(roomInfo.room.np) playMusic({url: roomInfo.room.np.url, title: roomInfo.room.np.name})
  //}

  if(!roomInfo || [event_join, event_leave, event_newhost, event_music].includes(type)){
    getRoom(
      function(info){
        prevRoomInfo = roomInfo;
        roomInfo = info;
        u = findUser(user);
        chrome.runtime.sendMessage({
          type: type,
          host: isHost(),
          user: user,
          trip: u ? u.tripcode : '',
          text: text,
          info: info,
          url: url
        });
      },
      function(){
        console.log("room error on info");
      }
    );
  }
  else{
    u = findUser(user);
    chrome.runtime.sendMessage({
      type: type,
      host: isHost(),
      user: user,
      trip: u ? u.tripcode : '',
      text: text,
      info: roomInfo,
      url: url
    });
  }
}

var logout = false;
function handle_exit(){
  $('.do-logout').click(function(){
    logout = true;
  });

  function confirmExit(){

    if(logout){
      if(alarms.length) // for alarms only
        chrome.runtime.sendMessage({
          type: event_logout,
          host: isHost(),
        });
      else console.log("logout without alarms");
    }
    else{
      if(alarms.length){
        chrome.runtime.sendMessage({
          type: event_exitalarm,
          host: isHost(),
        });
        // return "are you sure exit?";
      }
      else console.log("exittab without alarms");
      //type: event_exittab
    }
  }
  window.onbeforeunload = confirmExit;
  //window.onunload = confirmExit;
}

var ext_click = 0;
var org_post, ext_post;
function wrap_post_form(){
  function wrapper(callback){
    ext_click = 2;
    var cmd = '';
    //if($('textarea[name="message"]').val().match(/^\/mac/)){
    //  $('textarea[name="message"]').val('');
    //  $('#myModal').modal({
    //    backdrop: 'static',
    //    keyboard: false
    //  });
    //  $('#myModal').modal('show');
    //  return;
    //}
    if(!$('textarea[name="message"]').hasClass('state-secret') &&
      $('#url-icon').attr('data-status') !== 'filled' && enableMe &&
      !$('textarea[name="message"]').val().match(/^\/\w/)) cmd = '/me ';

    if(!$('textarea[name="message"]').val().match(/^\s*$/)){
      zh_conv((cvt)=>{
        $('textarea[name="message"]').val(
          cvt(cmd + $('textarea[name="message"]').val()));
        callback();
      });
    }
  }

  org_post = $('input[name="post"]');
  ext_post = org_post.clone().attr("name", "ext_post").attr('type', 'button');
  org_post.after(ext_post);
  org_post.wrap('<div style="display:none"></div>');

  if(org_post[0]){
    (new MutationObserver(function(mutations){
      mutations.forEach(function(mutation) {
        if(ext_click){
          ext_post.val(mutation.target.value);
          ext_click--;
        }
      });
    })).observe(org_post[0], { attributes: true });
  }

  ext_post.on('click', function(e){
    wrapper(()=> org_post.click());
  });

  $('textarea[name="message"]').on('keydown', function(e){
    if(!e.ctrlKey && !e.shiftKey && (e.keyCode || e.which) == 13){
      if($('#textcomplete-dropdown-1').is(':visible')) return;
      if(!e.originalEvent.mySecretVariableName) {
        e.preventDefault();
        wrapper(()=> org_post.click());
      }
    }
  });
}

function lambda_conservation(){

  var conservation = function(){
    var tc = $(this).parent().parent().find('.dropdown-item-tripcode').text();
    if(tc === '#L/CaT//Hsk')
      if(confirm("This cat is sooooo cute, it's λ. Do you really want to kick it?\n（你確定要踢這隻可愛的 λ 嗎？）")){
        alert("You Bad Bad >:3");
        var name = $(this).parent().parent().find('.dropdown-item-reply').text().substring(1);
        findUser(name, (u)=>{
          ctrlRoom({'new_host': u.id});
        });
      }
  }

  $(document).on('mousedown', '.dropdown-item-kick', conservation);

  $(document).on('mousedown', '.dropdown-item-ban', conservation);

  $(document).on('mousedown', '.dropdown-item-report-user', conservation);
}


function add_tag(url){
  return new Promise((res, rej)=>{
    var ft = url.split('.').pop();
    var tag = undefined;
    if(ft == 'css'){
      tag = document.createElement('link');
      tag.rel = "stylesheet";
      tag.href = url;
    }
    else if(ft == 'js'){
      tag = document.createElement('script');
      tag.src = url;
    }
    //tag.onload = function() { this.remove(); };
    if(tag){
      tag.onload = () => res(url);
      tag.onerror = () => rej(url);
      (document.head || document.documentElement).appendChild(tag);
    }
  });
}

function plug_live2d(){
  if (screen.width >= 768) {
    Promise.all([
      add_tag(chrome.runtime.getURL("live2d-widget/font-awesome.min.css")),
      add_tag(chrome.runtime.getURL("live2d-widget/waifu.css")),
      add_tag(chrome.runtime.getURL("live2d-widget/tw_cn.js")),
      add_tag(chrome.runtime.getURL("live2d-widget/live2d.min.js")),
      add_tag(chrome.runtime.getURL("live2d-widget/waifu-tips.js")),
    ]).then(() => {
      add_tag(chrome.runtime.getURL("live2d-widget/load.js"))
    });
  }
}

var lounge = undefined;
var jumpToRoom = undefined;

$(document).ready(function(){

  lambda_conservation();

  //$('#body').prepend(MacroModal);

  console.log($('#user_name').text());

  chrome.storage.sync.get(
    [SWITCH_ME, 'leaveRoom', 'jumpToRoom', 'profile', '#bg-url-input', '#name-color-input', '#name-bg-color-input'],
    (config) => {
      console.log(JSON.stringify(config));

      plug_live2d();
      //if(!config['profile'] ||
      //    config['profile'].id !== roomProfile().id)
      //    ajaxProfile(undefined, true, $('.room-title-name').text());

      chrome.storage.sync.set({'profile': roomProfile()});

      enableMe = config[SWITCH_ME] || false;

      if(config['leaveRoom']){
        disableLeave = true;
        planeGo(true, 12000);
        chrome.runtime.sendMessage({
          notification: {
            title: chrome.i18n.getMessage("fail_leave_title"),
            msg: chrome.i18n.getMessage("fail_leave_msg"),
            clear: true,
            pattern: ''
          }
        });
        //return setTimeout(()=>leaveRoom(undefined, undefined, true), 8000);
        return setTimeout(()=>leaveRoom(undefined, undefined, true), 9000);
      }

      jumpToRoom = config['jumpToRoom'];
      if(jumpToRoom == window.location.href){
        chrome.storage.sync.remove('jumpToRoom');
        console.log("remove jumped ROOM");
        planeArrive(true);
      }
      else if(jumpToRoom){
        config("You Are Not @TargetRoom, jump?") && leaveRoom(undefined, undefined, true);
      }

      $('#talks').bind('DOMNodeInserted', function(event) {
        var e = event.target;
        if(e.parentElement.id == 'talks')
          handle_talks(e);
        var ue = $(e).find($('.bubble p a'));
        var ytid = youtube_parser(ue.attr('href'));
        if(ytid){
          ue.replaceWith(`<iframe width="560" height="315" src="https://www.youtube.com/embed/${ytid}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`)
        }
      });

      //make_extinputs();
      wrap_post_form();
      monit_progressbar();
      /* invoke newtab event */
      chrome.runtime.sendMessage({
        type: event_newtab,
        host: isHost(),
      });
      console.log("start background moniter new");
      handle_exit();

      chrome.runtime.sendMessage({ clearNotes: true, pattern:'' });
      //'https://drrr.com/room/.*'

      if(config['#bg-url-input']){
        setTimeout(()=>changeBgImageURL({url: config['#bg-url-input']}), 100);
      }

      window.addEventListener("resize", ()=>{
        document.body.style.backgroundPosition = `right ${$('.message_box').height()}px`;
      });

      if(config['#name-color-input']){
        setTimeout(()=>changeNameClr({color: config['#name-color-input']}), 100);
      }

      if(config['#name-bg-color-input']){
        setTimeout(()=>changeNameBgClr({color: config['#name-bg-color-input']}), 100);
      }

      getRoom(
        function(RoomData){
          prevRoomInfo = roomInfo;
          roomInfo = RoomData; //roomInfo.profile
          console.log('roomInfo', roomInfo);

          // v if enter error, escape
          if(roomInfo.redirect){
            //chrome.storage.sync.remove('jumpToRoom');
            // ^ retain?
            console.log("remove jumped ROOM");
          }

          var find = ()=>monitRooms(true, roomInfo.room.roomId);
          setTimeout(find, 5000);
          setInterval(find, 90000);
        },
        function(data){
          alert("roomInfo error", data);
        }
      )
    }
  );
});

var exec_method = false;
var method_queue = [];
var exec_time_gap = 2500;

function do_method(){
  function _do_method(){
    if(method_queue.length){
      method_queue.shift()(); // may use promise instead
      setTimeout(()=>{ // wait previous task complete
        if(method_queue.length)
          _do_method();
        else exec_method = false;
      }, exec_time_gap);
    }
  }
  if(!exec_method){ exec_method = true; _do_method(); }
}

/*
function do_method(){
  if(!exec_method && method_queue.length){
    exec_method = true;
    new Promise((res, rej)=>{
      method_queue.shift()();
      res();
    }).then(()=>{
      if(method_queue.length) do_method();
      else exec_method = false;
    });
  }
}
*/

function emit_method(req, sender, callback){
  if(req.fn && need_callback.includes(req.fn)){
    methods[req.fn](req.args, callback);
  }
  else{
    method_queue.push(
      ((r) => {
        return ()=>methods[r.fn](r.args);
      })(req)
    );
    do_method();
    if(callback) callback();
  }
}

chrome.runtime.onMessage.addListener((req, sender, callback) => {
  console.log(JSON.stringify(req), "comes the method from background");
  console.log(req.fn, cache_profile);
  emit_method(req, sender, callback);
});
