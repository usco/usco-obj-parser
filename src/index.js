/**
 * @author mrdoob / http://mrdoob.com/
 * @author kaosat-dev
 */

import detectEnv from 'composite-detect'
import assign from 'fast.js/object/assign'
import Rx from 'rx'

import OBJ from './obj'

import { createModelBuffers } from './parseHelpers'

export const outputs = ['geometry'] // to be able to auto determine data type(s) fetched by parser
export const inputDataType = 'arrayBuffer' // to be able to set required input data type

export default function parse (data, parameters = {}) {
  const defaults = {
    useWorker: (detectEnv.isBrowser === true),
    offsets: [0]
  }
  parameters = assign({}, defaults, parameters)

  const {useWorker, offsets} = parameters
  const obs = new Rx.ReplaySubject(1)

  if (useWorker) {
    let worker = new Worker('./worker.js') // browserify

    worker.onmessage = function (event) {
      if ('data' in event.data) {
        var data = event.data.data
        data.objects.forEach((modelData, index) => {
          obs.onNext({progress: (index + 1) / Object.keys(data.objects).length, total: undefined})
          obs.onNext(createModelBuffers(modelData))
        })
        obs.onNext({progress: 1, total: undefined})
        obs.onCompleted()
      }
      else if ('progress' in event.data) {
        // console.log("got progress", event.data.progress)
        obs.onNext({progress: event.data.progress, total: Math.NaN})
      }
    }
    worker.onerror = function (event) {
      obs.onError(`filename:${event.filename} lineno: ${event.lineno} error: ${event.message}`)
    }
    worker.postMessage({data})
    obs.catch(e => worker.terminate())
  } else {
    data = new OBJ().getData(data)

    data.objects.forEach((modelData, index) => {
      obs.onNext({progress: (index + 1) / Object.keys(data.objects).length, total: undefined})
      obs.onNext(createModelBuffers(modelData))

      if (index >= data.objects.length) { // FIXME: not too sure about this implementation
        obs.onNext({progress: 1, total: undefined})
        obs.onCompleted()
      }
    })


  }
  return obs
}
