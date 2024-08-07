import React, { useEffect, useRef, useState } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import XHRUpload from "@uppy/xhr-upload";
import "@uppy/core/dist/style.css";
import "@uppy/dashboard/dist/style.css";
import "./UploadPage.css";
import logo from './assets/BCID_H_rgb_pos.png';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { ClipLoader } from "react-spinners"; // Import the spinner component

const UploadPage = () => {
  const uppyRef = useRef(null);
  const [loading, setLoading] = useState(false); // State to manage loading
  const [metadataFields, setMetadataFields] = useState({
    hyperlink: "",
    additionalField: ""
  });

  useEffect(() => {
    const uppy = new Uppy({
      id: 'uppy',
      autoProceed: false,
      restrictions: {
        maxNumberOfFiles: 1,
      }
    })
    .use(Dashboard, {
      inline: true,
      target: '#uppy-dashboard',
      showProgressDetails: true,
      height: 400
    })
    .use(XHRUpload, {
      method: 'PUT',
      endpoint: 'http://localhost:5173/tika/tika', // This needs to match your backend endpoint
      fieldName: 'file',
      headers: (file) => ({
        'Content-Type': file.type,
        'Accept': 'application/json',
      })
    });

    uppy.on('file-added', (file) => {
      console.log('File added to Uppy:', file);
      // Attach metadata to the file
      uppy.setFileMeta(file.id, {
        hyperlink: metadataFields.hyperlink,
        additionalField: metadataFields.additionalField
      });
    });

    uppy.on('upload', () => {
      console.log('Upload started');
      setLoading(true); // Show loading when upload starts
    });

    uppy.on('upload-success', (file, response) => {
      console.log('Upload successful:', response);

      // Use response to get the uploaded file data and proceed with the next steps
      const fileType = file.type;
      console.log('File type:', fileType);

      handleUploadSuccess(file, response);
    });

    uppyRef.current = uppy;

    return () => {
      uppy.close;
    };
  }, [metadataFields]);

  const handleUploadSuccess = async (file, response) => {
    try {
      // Extract file data from response if available
      const fileData = file.data || response.body || response; // Adjust as needed
      console.log('File data to be sent:', fileData);

      // Send file to /meta endpoint
      const metaResponse = await axios.put('http://localhost:5173/tika/tika', fileData, {
        headers: {
          'Content-Type': file.type,
          'Accept': 'application/json',
        },
        onUploadProgress: progressEvent => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          console.log(`Meta upload progress: ${progress}%`);
        }
      });
      console.log('Meta response:', metaResponse);

      const metadata = metaResponse.data;
      console.log('Metadata:', metadata);

      // Send file to /tika endpoint for cleaned content
      const cleanedContentResponse = await axios.put('http://localhost:5173/tika/tika', fileData, {
        headers: {
          'Content-Type': file.type,
          'Accept': 'text/plain',
        },
        onUploadProgress: progressEvent => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          console.log(`Content upload progress: ${progress}%`);
        }
      });
      console.log('Cleaned content response:', cleanedContentResponse);

      const cleanedContent = cleanedContentResponse.data;
      console.log('Cleaned content:', cleanedContent);

      // Combine metadata and cleaned content
      const combinedData = {
        ...metadata,
        'X-TIKA:content': cleanedContent, // Replacing original X-TIKA:content
        'id': uuidv4(),
        'hyperlink': metadataFields.hyperlink, // Use metadata from state
        'additionalField': metadataFields.additionalField // Use metadata from state
      };

      console.log('Combined data to be sent to Meilisearch:', combinedData);

      // Send combined data to Meilisearch
      await axios.post('https://meilisearch-test.apps.silver.devops.gov.bc.ca/indexes/uppy/documents', combinedData);

      console.log('Original response from Tika:', metadata);
      console.log('Cleaned content:', cleanedContent);
      console.log('Combined data sent to Meilisearch:', combinedData);

      // Handle success (e.g., notify the user)
      alert('Document uploaded and indexed successfully!');
    } catch (error) {
      console.error('Error handling upload response:', error);
      alert('There was an error uploading or indexing the document.');
    } finally {
      setLoading(false); // Hide loading when upload completes or fails
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted, starting upload');
    uppyRef.current.upload();
  };

  const handleMetadataChange = (e) => {
    const { name, value } = e.target;
    setMetadataFields((prevFields) => ({
      ...prevFields,
      [name]: value
    }));
  };

  return (
    <div className="upload-page">
      <div className="upload-header">
        <img src={logo} alt="Logo" className="upload-header-logo" />
        <h1>Document Upload</h1>
        <button onClick={() => window.location.href = "/"} className="upload-upload-button">Back to Search</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Hyperlink to Original File:
            <input
              type="text"
              name="hyperlink"
              value={metadataFields.hyperlink}
              onChange={handleMetadataChange}
              required
            />
          </label>
        </div>
        {/* Add additional metadata fields here */}
        <div>
          <label>
            Additional Metadata:
            <input
              type="text"
              name="additionalField"
              value={metadataFields.additionalField}
              onChange={handleMetadataChange}
            />
          </label>
        </div>
        <button type="submit">Upload File</button>
      </form>
      <div id="uppy-dashboard"></div>
      {loading && (
        <div className="loading-indicator">
          <ClipLoader color="#123abc" loading={loading} size={50} />
          <p>Uploading and processing file...</p>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
