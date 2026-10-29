/* The Wellness Way Supplies – DRAFT member portal.
   DEMO ONLY: there is no real authentication. Everything is stored in THIS browser's
   localStorage and nothing is ever sent over the network.
   Membership is by invitation; there is no sign-up. The ONLY member is the demo account
   below. The typed password is compared in memory and discarded – it is never stored. */
(function(){
  var LS = window.localStorage;
  var K = { profile:"wws_profile_ethan", session:"wws_session" };

  /* ---- demo account (fake, client-side only, for walkthroughs) ---- */
  var DEMO_ACCOUNT = { id:"ethan", username:"Ethan", demoPassword:"1111" };
  var DEMO_PROFILE = { id:"ethan", username:"Ethan", name:"Ethan", role:"Demo member", email:"[TBD]",
    facility:"Demo Facility [TBD]", city:"[TBD]", state:"[TBD]", phone:"[TBD]",
    ship:{ line1:"[TBD]", line2:"", city:"[TBD]", state:"[TBD]", zip:"[TBD]" }, demo:true };

  function readJSON(k, d){ try{ var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }

  var Auth = {
    profile: function(){ var p = readJSON(K.profile, null); if(!p){ p = JSON.parse(JSON.stringify(DEMO_PROFILE)); this.saveProfile(p); } return p; },
    saveProfile: function(p){ p.id = DEMO_ACCOUNT.id; p.username = DEMO_ACCOUNT.username; LS.setItem(K.profile, JSON.stringify(p)); },
    resetProfile: function(){ LS.removeItem(K.profile); },
    logIn: function(user, typedPassword){
      var ok = String(user || "").trim() === DEMO_ACCOUNT.username && String(typedPassword || "") === DEMO_ACCOUNT.demoPassword;
      typedPassword = null; /* never stored */
      if(!ok) return { ok:false, error:"Username or password not recognised. Membership is by invitation." };
      LS.setItem(K.session, DEMO_ACCOUNT.id); this.profile(); return { ok:true };
    },
    logOut: function(){ LS.removeItem(K.session); },
    current: function(){ return LS.getItem(K.session) === DEMO_ACCOUNT.id ? this.profile() : null; },
    requireMember: function(loginUrl){
      if(!this.current()){
        var here = location.pathname.split("/").pop() + location.search;
        location.replace(loginUrl + "?next=" + encodeURIComponent(here));
      }
    }
  };
  /* clean up keys from earlier draft builds (other demo members / sessionStorage flag) */
  try{ LS.removeItem("wws_members"); sessionStorage.removeItem("wws_demo_signed_in"); }catch(e){}
  window.WWSAuth = Auth;
})();
