import MyApp      from './comps/app.js';
import MyButton   from './comps/button.js';
import MyFilters  from './comps/filters.js';
import MyHome     from './comps/home.js';
import MySettings from './comps/settings.js';
import MyStore    from './stores/store.js';
import {
	MyGoForm,
	MyGoModule
} from './comps/go.js';
import {
	MyBool,
	MyBoolStringNumber
} from './comps/input.js';

// admin
import MyAdmin               from './comps/admin/admin.js';
import MyAdminBackups        from './comps/admin/adminBackups.js';
import MyAdminCluster        from './comps/admin/adminCluster.js';
import MyAdminConfig         from './comps/admin/adminConfig.js';
import MyAdminCustom         from './comps/admin/adminCustom.js';
import MyAdminFiles          from './comps/admin/adminFiles.js';
import MyAdminLdaps          from './comps/admin/adminLdaps.js';
import MyAdminLicense        from './comps/admin/adminLicense.js';
import MyAdminLogins         from './comps/admin/adminLogins.js';
import MyAdminLoginTemplates from './comps/admin/adminLoginTemplates.js';
import MyAdminLogs           from './comps/admin/adminLogs.js';
import MyAdminMailAccounts   from './comps/admin/adminMailAccounts.js';
import MyAdminMailSpooler    from './comps/admin/adminMailSpooler.js';
import MyAdminMailTraffic    from './comps/admin/adminMailTraffic.js';
import MyAdminModules        from './comps/admin/adminModules.js';
import MyAdminRepo           from './comps/admin/adminRepo.js';
import MyAdminRoles          from './comps/admin/adminRoles.js';
import MyAdminScheduler      from './comps/admin/adminScheduler.js';

// builder
import MyBuilder            from './comps/builder/builder.js';
import MyBuilderApi         from './comps/builder/builderApi.js';
import MyBuilderApis        from './comps/builder/builderApis.js';
import MyBuilderArticles    from './comps/builder/builderArticles.js';
import MyBuilderCollection  from './comps/builder/builderCollection.js';
import MyBuilderCollections from './comps/builder/builderCollections.js';
import MyBuilderForm        from './comps/builder/builderForm.js';
import MyBuilderForms       from './comps/builder/builderForms.js';
import MyBuilderIcons       from './comps/builder/builderIcons.js';
import MyBuilderJsFunction  from './comps/builder/builderJsFunction.js';
import MyBuilderJsFunctions from './comps/builder/builderJsFunctions.js';
import MyBuilderLoginForms  from './comps/builder/builderLoginForms.js';
import MyBuilderMenu        from './comps/builder/builderMenu.js';
import MyBuilderModule      from './comps/builder/builderModule.js';
import MyBuilderModules     from './comps/builder/builderModules.js';
import MyBuilderPgFunction  from './comps/builder/builderPgFunction.js';
import MyBuilderPgFunctions from './comps/builder/builderPgFunctions.js';
import MyBuilderRelation    from './comps/builder/builderRelation.js';
import MyBuilderRelations   from './comps/builder/builderRelations.js';
import MyBuilderRole        from './comps/builder/builderRole.js';
import MyBuilderRoles       from './comps/builder/builderRoles.js';
import MyBuilderStart       from './comps/builder/builderStart.js';

// router
const MyRouterPositions = Object.create(null);
const MyRouter = VueRouter.createRouter({
	history:VueRouter.createWebHashHistory(),
	routes:[{
		path:'/home',
		component:MyHome,
		props:true
	},{
		path:'/settings',
		component:MySettings
	},{
		path:'/app/:moduleName/:moduleNameChild?',
		component:MyGoModule,
		props:true
	},{
		path:'/app/:moduleName/:moduleNameChild?/form/:formId/:recordIdString(\\d+)?',
		component:MyGoForm,
		meta:{ atModule:true },
		props:true
	},{
		path:'/admin',
		redirect:'/admin/config',
		component:MyAdmin,
		children:[
			{ path:'backups',        component:MyAdminBackups },
			{ path:'cluster',        component:MyAdminCluster },
			{ path:'config',         component:MyAdminConfig },
			{ path:'custom',         component:MyAdminCustom },
			{ path:'files',          component:MyAdminFiles },
			{ path:'ldaps',          component:MyAdminLdaps },
			{ path:'license',        component:MyAdminLicense },
			{ path:'logins',         component:MyAdminLogins },
			{ path:'logintemplates', component:MyAdminLoginTemplates },
			{ path:'logs',           component:MyAdminLogs },
			{ path:'mailaccounts',   component:MyAdminMailAccounts },
			{ path:'mailspooler',    component:MyAdminMailSpooler },
			{ path:'mailtraffic',    component:MyAdminMailTraffic },
			{ path:'modules',        component:MyAdminModules },
			{ path:'repo',           component:MyAdminRepo },
			{ path:'roles',          component:MyAdminRoles },
			{ path:'scheduler',      component:MyAdminScheduler }
		]
	},{
		path:'/builder',
		redirect:'/builder/modules',
		component:MyBuilder,
		children:[
			{
				path:'modules',
				component:MyBuilderModules
			},{
				path:'start/:id',
				meta:{ nav:'start', target:'module' },
				component:MyBuilderStart,
				props:true
			},{
				path:'module/:id',
				meta:{ nav:'module', target:'module' },
				component:MyBuilderModule,
				props:true
			},{
				path:'relations/:id',
				meta:{ nav:'relations', target:'module' },
				component:MyBuilderRelations,
				props:true
			},{
				path:'relation/:id',
				meta:{ nav:'relations', target:'relation' },
				component:MyBuilderRelation,
				props:true
			},{
				path:'icons/:id',
				meta:{ nav:'icons', target:'module' },
				component:MyBuilderIcons,
				props:true
			},{
				path:'menu/:id',
				meta:{ nav:'menu', target:'module' },
				component:MyBuilderMenu,
				props:true
			},{
				path:'forms/:id',
				meta:{ nav:'forms', target:'module' },
				component:MyBuilderForms,
				props:true
			},{
				path:'form/:id',
				meta:{ nav:'forms', target:'form' },
				component:MyBuilderForm,
				props:true
			},{
				path:'pg-functions/:id',
				meta:{ nav:'pg-functions', target:'module' },
				component:MyBuilderPgFunctions,
				props:true
			},{
				path:'js-functions/:id',
				meta:{ nav:'js-functions', target:'module' },
				component:MyBuilderJsFunctions,
				props:true
			},{
				path:'roles/:id',
				meta:{ nav:'roles', target:'module' },
				component:MyBuilderRoles,
				props:true
			},{
				path:'role/:id',
				meta:{ nav:'roles', target:'role' },
				component:MyBuilderRole,
				props:true
			},{
				path:'collections/:id',
				meta:{ nav:'collections', target:'module' },
				component:MyBuilderCollections,
				props:true
			},{
				path:'collection/:id',
				meta:{ nav:'collections', target:'collection' },
				component:MyBuilderCollection,
				props:true
			},{
				path:'login-forms/:id',
				meta:{ nav:'login-forms', target:'module' },
				component:MyBuilderLoginForms,
				props:true
			},{
				path:'pg-function/:id',
				meta:{ nav:'pg-functions', target:'pg-function' },
				component:MyBuilderPgFunction,
				props:true
			},{
				path:'js-function/:id',
				meta:{ nav:'js-functions', target:'js-function' },
				component:MyBuilderJsFunction,
				props:true
			},{
				path:'articles/:id',
				meta:{ nav:'articles', target:'module' },
				component:MyBuilderArticles,
				props:true
			},{
				path:'apis/:id',
				meta:{ nav:'apis', target:'module' },
				component:MyBuilderApis,
				props:true
			},{
				path:'api/:id',
				meta:{ nav:'apis', target:'api' },
				component:MyBuilderApi,
				props:true
			}
		]
	},{
		path:'/:pathMatch(.*)*',
		redirect:'/home'
	}],
	scrollBehavior(to,from,savedPosition) {
		
		// recover scroll position of form element if available
		if(typeof MyRouterPositions[to.path] !== 'undefined') {
			let e = document.getElementById(MyStore.getters.constants.scrollFormId);
			
			if(e !== null)
				setTimeout(() => e.scrollTop = MyRouterPositions[to.path],50);
			
			return { top:0 };
		}
		
		// hash scrolling for HTML anchors
		if(to.hash !== '') {
			let parts = to.hash.substr(1).split('#')
			
			if(parts.length > 0) {
				let e = document.getElementById(parts[0]);
				
				if(e !== null)
					e.scrollIntoView();
			}
		}
		return { top:0 };
	}
});
MyRouter.beforeEach((to,from) => {
	// confirm unsaved form changes
	for(let f of MyStore.getters.routingGuards) {
		if(!f()) return false;
	}
	
	// store scroll position of form element if available
	let e = document.getElementById(MyStore.getters.constants.scrollFormId);
	if(e !== null)
		MyRouterPositions[from.path] = e.scrollTop;
	
	return true;
});

// define main app
const app = Vue.createApp(MyApp)
	.use(MyRouter)
	.use(MyStore)
	.directive('focus', { mounted:el => el.focus()})
	.component('draggable',window.vuedraggable)
	.component('my-bool',MyBool)
	.component('my-bool-string-number',MyBoolStringNumber)
	.component('my-button',MyButton)
	.component('my-filters',MyFilters)
;

app.directive('click-outside',{
	beforeMount(el,binding,vnode) {
		el.clickOutsideEvent = function(event) {
			
			if(el !== event.target && !el.contains(event.target))
				binding.value();
		};
		document.body.addEventListener('click',el.clickOutsideEvent);
	},
	unmounted(el) {
		document.body.removeEventListener('click',el.clickOutsideEvent);
	}
});

// mount main app
app.mount('#app-mount');

// basic service worker
// keep worker script name consistent so that browser can check for updates
if('serviceWorker' in navigator) {
	window.addEventListener('load',function() {
		navigator.serviceWorker
			.register('/worker.js')
			.then(function(reg) {
				if(!navigator.serviceWorker.controller || reg.waiting || reg.installing)
					return;
				
				reg.addEventListener('updatefound',function() {
					let worker = reg.installing;
					worker.addEventListener('statechange',function() {
						
						// reload page if new worker has been activated
						if(worker.state === 'activated')
							location.reload(false);
					});
				});
			})
			.catch(err => console.log('service worker not registered', err))
	});
}